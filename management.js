const fs = require('fs');
const util = require('util');
const mongoose = require('mongoose');
const parse = util.promisify(require('csv-parse'));
const readFile = util.promisify(fs.readFile);
const _ = require('lodash');

let employees = [];
let projects = [];
let tasks = [];

const importEmployees = async filePath => {
  console.log('filePath', filePath);
  const labels = {firstName: 'First Name', lastName: 'Last Name', supervisor: 'Supervisor'};
  const employeesDirty = await parse(await readFile(filePath), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const trash = employeesDirty.filter(employee =>
    _.isEmpty(employee[labels.firstName]) || _.isEmpty(employee[labels.lastName]));
  const result = employeesDirty.filter(employee => !_.isEmpty(employee[labels.firstName])
    && !_.isEmpty(employee[labels.lastName]) && _.isEmpty(employee[labels.supervisor]));
  let candidates = employeesDirty.filter(employee => !_.isEmpty(employee[labels.firstName])
    && !_.isEmpty(employee[labels.lastName]) && !_.isEmpty(employee[labels.supervisor]));
  const lastNames = result.map(employee => employee[labels.lastName]);

  while (candidates.length > 0) {
    const candidate = _.head(candidates);
    candidates = _.tail(candidates);
    if (candidate) {
      const needle = candidate[labels.supervisor];
      const inTrash = _.find(trash, function(o) {
        return o[labels.firstName] === candidate[labels.firstName] && o[labels.lastName] === candidate[labels.lastName];
      });
      const inEmployees = _.find(result, function(o) {
        return o[labels.firstName] === candidate[labels.firstName] && o[labels.lastName] === candidate[labels.lastName];
      });
      if (!inTrash && !inEmployees) {
        const candidateLastNames = candidates.map(employee => employee[labels.lastName]);
        if (lastNames.indexOf(needle) >= 0 && !inEmployees) {
          result.push(candidate);
          lastNames.push(candidate[labels.lastName]);
        } else if (!candidate.visited && candidateLastNames.indexOf(needle) >= 0) {
          candidate.visited = true;
          candidates.push(candidate);
        } else {
          trash.push(candidate);
        }
      }
    }
  }
  employees = result.map(employee => {return {
    id: '' + mongoose.Types.ObjectId(),
    name: employee[labels.firstName],
    lastName: employee[labels.lastName],
    supervisor: employee[labels.supervisor],
    projectIds: []
  }});
};

const importProjects = async filePath => {
  const labels = {name: 'Name', startDate: 'Start Date', slack: 'Buffer'};
  const dirty = await parse(await readFile(filePath), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const results = [];
  const names = [];
  const isValidDate = dirtyDate => {
    const date = new Date(dirtyDate);
    return date instanceof Date && !isNaN(date);
  };
  for (let candidate of dirty) {
    const name = _.trim(candidate[labels.name]);
    const nameIsOk = name.length > 0 && names.indexOf(name) < 0;
    const startDateStr = candidate[labels.startDate];
    const slack = parseInt(candidate[labels.slack]);
    if (nameIsOk && names.indexOf(name) < 0 && isValidDate(startDateStr) && !isNaN(slack)) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(startDateStr);
      endDate.setDate(endDate.getDate() + slack);
      names.push(name);
      results.push({
        id: '' + mongoose.Types.ObjectId(),
        name: name,
        startDate: startDate,
        slack: slack,
        endDate: endDate,
        taskIds: [],
        employeeId: null,
        estimated: slack
      });
    }
  }
  projects = results;
};

const importTasks = async filePath => {
  const labels = {name: 'Name', description: 'Description', estimated: 'Estimated Hours'};
  const dirty = await parse(await readFile(filePath), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const results = [];
  const names = [];

  for (let candidate of dirty) {
    const name = _.trim(candidate[labels.name]);
    const nameIsOk = name.length > 0 && names.indexOf(name) < 0;
    const description = _.trim(candidate[labels.description]);
    const estimated = parseInt(candidate[labels.estimated]);
    if (nameIsOk && names.indexOf(name) < 0 && description.length > 0 && !isNaN(estimated)) {
      names.push(name);
      results.push({
        id: '' + mongoose.Types.ObjectId(),
        name: name,
        description: description,
        estimated: estimated,
        projectId: null
      });
    }
  }
  tasks = results;
};

const findOne = (collection, id) => {
  for (let item of collection) {
    if (item.id === id) {
      return item;
    }
  }
  return null;
};

// Projects can be assigned to individual employees (1 project <-> 1 employee)
const assignProject = async (employeeId, projectId) => {
  const employee = findOne(employees, employeeId);
  const project = findOne(projects, projectId);
  if (project && !project.employeeId && employee && employee.projectIds.length < 2) {
    employee.projectIds.push(project.id);
    project.employeeId = employee.id;
    return true;
  }
  return false;
};

const deleteProject = async projectId => {
  let project = null;
  projects = projects.filter(item => {
    if (item.id === projectId) {
      project = item;
    } else {
      return true;
    }
  });
  if (project) {
    const employee = findOne(employees, project.employeeId);
    if (employee) {
      _.remove(employee.projectIds, id => id === projectId);
    }
    for (let taskId of project.taskIds) {
      const task = findOne(tasks, taskId);
      task.projectId = null;
    }
    return true;
  }
  return false;
};

// Assuming that projects can‘t be worked on parallel
const getDays = projectIds => {
  return _.reduce(_.uniq(projectIds), (sum, projectId) => {
    const project = findOne(projects, projectId);
    return project ? sum + project.estimated : sum;
  }, 0);
};

// Can we assign the same task to many projects? Let's assume we don't
const assignTask = async (projectId, taskId) => {
  const project = findOne(projects, projectId);
  const task = findOne(tasks, taskId);
  if (project && task && !task.projectId) {
    project.taskIds = _.concat(project.taskIds, taskId);
    const endDate = project.endDate;
    endDate.setDate(endDate.getDate() + task.estimated);
    project.endDate = endDate;
    project.estimated += task.estimated;
    task.projectId = project.id;
    return true;
  }
  return false;
};

const deleteTask = async taskId => {
  let task = null;
  tasks = tasks.filter(item => {
    if (item.id === taskId) {
      task = item;
    } else {
      return true;
    }
  });
  if (task) {
    if (task.projectId) {
      const project = findOne(projects, task.projectId);
      if (project) {
        _.remove(project.taskIds, id => id === taskId);
        const endDate = project.endDate;
        endDate.setDate(endDate.getDate() - task.estimated);
        project.endDate = endDate;
        project.estimated -= task.estimated;
      }
    }
    return true;
  }
  return false;
};

const displayProjectTasks = projectId => {
  const project = findOne(projects, projectId);
  if (project) {
    console.log('List of task for project: ', project.name, '(', projectId, ')');
    for (let taskId of project.taskIds) {
      const task = findOne(tasks, taskId);
      console.log('- task', task);
    }
  }
};

const allEmployees = () => {
  return employees;
};

const allProjects = () => {
  return projects;
};

const allTasks = () => {
  return tasks;
};

module.exports = {importEmployees, importProjects, importTasks, assignProject, deleteProject, assignTask, deleteTask,
  displayProjectTasks, allEmployees, allProjects, allTasks, getDays};
