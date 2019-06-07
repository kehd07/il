const fs = require('fs');
const util = require('util');
const mongoose = require('mongoose');
const parse = util.promisify(require('csv-parse'));
const readFile = util.promisify(fs.readFile);
const _ = require('lodash');

let employees = [];
let projects = [];
let tasks = [];

const importEmployees = async () => {
  const labels = {firstName: 'First Name', lastName: 'Last Name', supervisor: 'Supervisor'};
  const employeesDirty = await parse(await readFile('csv/employees.csv'), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const trash = employeesDirty.filter(employee => _.isEmpty(employee[labels.firstName]) || _.isEmpty(employee[labels.lastName]));
  const employees = employeesDirty.filter(employee => !_.isEmpty(employee[labels.firstName]) && !_.isEmpty(employee[labels.lastName]) && _.isEmpty(employee[labels.supervisor]));
  let candidates = employeesDirty.filter(employee => !_.isEmpty(employee[labels.firstName]) && !_.isEmpty(employee[labels.lastName]) && !_.isEmpty(employee[labels.supervisor]));
  const lastNames = employees.map(employee => employee[labels.lastName]);

  while (candidates.length > 0) {
    const candidate = _.head(candidates);
    candidates = _.tail(candidates);
    if (candidate) {
      const needle = candidate[labels.supervisor];
      const inTrash = _.find(trash, function(o) {
        return o[labels.firstName] === candidate[labels.firstName] && o[labels.lastName] === candidate[labels.lastName];
      });
      const inEmployees = _.find(employees, function(o) {
        return o[labels.firstName] === candidate[labels.firstName] && o[labels.lastName] === candidate[labels.lastName];
      });
      if (!inTrash && !inEmployees) {
        const candidateLastNames = candidates.map(employee => employee[labels.lastName]);
        if (lastNames.indexOf(needle) >= 0 && !inEmployees) {
          employees.push(candidate);
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
  return employees;
};

const importProjects = async () => {
  const labels = {name: 'Name', startDate: 'Start Date', slack: 'Buffer'};
  const dirty = await parse(await readFile('csv/projects.csv'), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const projects = [];
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
      projects.push({
        id: mongoose.Types.ObjectId(),
        name: name,
        startDate: startDate,
        slack: slack,
        endDate: endDate,
        taskIds: []
      });
    }
  }
  return projects;
};

const importTasks = async () => {
  const labels = {name: 'Name', description: 'Description', estimated: 'Estimated Hours'};
  const dirty = await parse(await readFile('csv/tasks.csv'), {
    delimiter: ',',
    columns: true,
    trim: true,
    skip_lines_with_error: true
  });
  const tasks = [];
  const names = [];

  for (let candidate of dirty) {
    const name = _.trim(candidate[labels.name]);
    const nameIsOk = name.length > 0 && names.indexOf(name) < 0;
    const description = _.trim(candidate[labels.description]);
    const estimated = parseInt(candidate[labels.estimated]);
    if (nameIsOk && names.indexOf(name) < 0 && description.length > 0 && !isNaN(estimated)) {
      names.push(name);
      tasks.push({
        id: mongoose.Types.ObjectId(),
        name: name,
        description: description,
        estimated: estimated
      });
    }
  }
  return tasks;
};

const findOne = (collection, id) => {
  for (let item of collection) {
    if (item.id === id) {
      return item;
    }
  }
  return {};
};

const findProjectsWithTask = async (taskId) => {
  return projects.filter(project => project.taskIds.indexOf(taskId) >= 0);
};

// Assign a project to an employee (an employee can only work on two projects at the same time)
const assignProject = async () => {

};

const deleteProject = async () => {

};

// Can we assign the same task to many projects? Let's suppose we do
const assignTask = async (projectId, taskId) => {
  const project = findOne(projects, projectId);
  const task = findOne(tasks, taskId);
  if (!_.isEmpty(project) && !_.isEmpty(task)) {
    project.taskIds = _.concat(project.taskIds, taskId);
    const endDate = project.endDate;
    endDate.setDate(endDate.getDate() + task.estimated);
    project.endDate = endDate;
  }
};

// Delete a task (don‘t forget to update the underlying references)
const deleteTask = async (taskId) => {
  const task = findOne(tasks, taskId);
  if (task) {
    const projectsToUpdate = await findProjectsWithTask(task.id);
    for (let project of projectsToUpdate) {
      _.remove(project.taskIds, id => id === taskId);
      const endDate = project.endDate;
      endDate.setDate(endDate.getDate() - task.estimated);
      project.endDate = endDate;
    }
  }
};

const displayEmployess = () => {
  console.log('Lis of employees:');
  console.log(employees);
};

const displayProjectTasks = (projectId) => {
  const project = findOne(projects, projectId);
  console.log(project);
  if (project) {
    console.log('List of task for project: ', project.name, '(', projectId, ')');
    /*
    for (let taskId of project.taskIds) {
      const task = findOne(tasks, taskId);
      console.log(task);
    }
    */
  }
};

Promise.all([importEmployees(), importProjects(), importTasks()])
  .then(async results => {
    employees = results[0];
    projects = results[1];
    tasks = results[2];

    findOne(tasks, tasks[3].id);
    await assignTask(projects[1].id, tasks[3].id);
    await deleteTask(tasks[3].id);

    // displayProjectTasks(projects[1].id);

  })
  .catch(error => {
    console.log('Error', error);
  });
