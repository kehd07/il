const assert = require('assert');
const {importEmployees, importProjects, importTasks, assignProject, deleteProject, assignTask, deleteTask,
  allEmployees, allProjects, allTasks, getDays} = require('../management.js');

describe('Array', function() {
  describe('#indexOf()', function() {
    it('Has no repetitions', function() {
      let needle = {name: 'Daniel', lastName: 'Schäfer'};
      let hits = 0;
      for (let employee of allEmployees()) {
        if (employee.name === needle.name && employee.lastName === needle.lastName) {
          hits++
        }
      }
      assert.equal(hits, 1);

      needle = 'System Fix';
      hits = 0;
      for (let project of allProjects()) {
        if (project.name === needle) {
          hits++
        }
      }
      assert.equal(hits, 1);

      needle = 'Indexing';
      hits = 0;
      for (let task of allTasks()) {
        if (task.name === needle) {
          hits++
        }
      }
      assert.equal(hits, 1);
    });

    it('Importes 9 employees', function() {
      assert.equal(allEmployees().length, 9);
    });

    it('Can assign a project to an employee', async function () {
      const employees = allEmployees();
      const projects = allProjects();
      const assigned = await assignProject(employees[2].id, projects[1].id);
      assert.equal(assigned, true);
      assert.equal(employees[2].projectIds.indexOf(projects[1].id), 0);
      assert.equal(projects[1].employeeId, employees[2].id);
    });

    it('Can assign a task to a project', async function() {
      const projects = allProjects();
      const initialEstimated = projects[1].estimated;
      const tasks = allTasks();
      const assigned = await assignTask(projects[1].id, tasks[3].id);
      assert.equal(assigned, true);
      assert.equal(tasks[3].projectId, projects[1].id);
      assert.equal(projects[1].taskIds.indexOf(tasks[3].id), 0);
      assert.equal(projects[1].estimated, initialEstimated + tasks[3].estimated);
    });

    it('Can delete a task', async function() {
      const projects = allProjects();
      let tasks = allTasks();
      const numberOfTasks = tasks.length;
      const deleted = await deleteTask(tasks[3].id);
      tasks = allTasks();
      assert.equal(deleted, true);
      assert.equal(numberOfTasks, tasks.length + 1);
      assert.equal(tasks[3].projectId, null);
      assert.equal(projects[1].taskIds.length, 0);
      assert.equal(projects[1].estimated, projects[1].slack);
    });

    it('Can delete a project', async function() {
      let projects = allProjects();
      const employees = allEmployees();
      const tasks = allTasks();
      const numberOfProjects = projects.length;
      await assignTask(projects[1].id, tasks[3].id);
      const deleted = await deleteProject(projects[1].id);
      projects = allProjects();
      assert.equal(deleted, true);
      assert.equal(numberOfProjects, projects.length + 1);
      assert.equal(employees[2].projectIds.length, 0);
      assert.equal(tasks[3].projectId, null);
    });

    it('Can getDays', async function() {
      let projects = allProjects();
      const days = await getDays([projects[0].id, projects[1].id]);
      assert.equal(projects[0].estimated + projects[1].estimated, days);
    });

  });
});

Promise.all([
  importEmployees('./csv/employees.csv'),
  importProjects('csv/projects.csv'),
  importTasks('csv/tasks.csv')])
  .then(async () => {})
  .catch(error => {
    console.log('Error', error);
  });

