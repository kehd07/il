const {importEmployees, importProjects, importTasks, assignProject, deleteProject, assignTask, deleteTask,
  displayProjectTasks, allEmployees, allProjects, allTasks, getDays} = require('./management.js');
const _ = require('lodash');

Promise.all([
  importEmployees('csv/employees.csv'),
  importProjects('csv/projects.csv'),
  importTasks('csv/tasks.csv')])
  .then(async results => {
    const employees = allEmployees();

    console.log(`
    Welcome to Minimal Project Management System
    Employees, projects and task have been loaded from:
    ./csv/employees.csv, ./csv/projects.csv and ./csv/tasks.csv`);

    const menu = `
    - To assign the task to a project enter:
      assign -p projectId -t taskId
    - To assign a project to an employee enter:
      assign -p projectId -e employeeId

    - To delete a task
      delete -t taskId
    - To delete a project
      delete -p projectId

    - Display all employees
      display -e
    - Display all projects (You will need the ids)
      display -p
    - Display all tasks (You will need the ids)
      display -t
    - Display all tasks for a given project
      displayTasks -p projectId

    - Getting the total days needed for a given list of projects
      days -p projectId1 projectId2 projectIdN
      
      Please enter an option keeping the order of the parameters`;
    console.log(menu);


    let selectedOption;
    const stdin = process.openStdin();
    stdin.addListener("data", async function (d) {
      const option = d.toString().trim();
      const tokens = option.split(' ');

      if (tokens[0] === 'assign') {
        if (tokens[1] === '-p' && tokens[3] === '-t') {
          const projectId = tokens[2];
          const taskId = tokens[4];
          const ans = await assignTask(projectId, taskId);
          console.log(tokens, ans);
        } else if (tokens[1] === '-p' && tokens[3] === '-e') {
          const projectId = tokens[2];
          const employeeId = tokens[4];
          const ans = await assignProject(employeeId, projectId);
          console.log(tokens, ans);
        } else {
          console.log('Sorry I didn\'t understand that', tokens);
        }
      } else if (tokens[0] === 'delete') {
        if (tokens[1] === '-t') {
          const taskId = tokens[2];
          const ans = await deleteTask(taskId);
          console.log(tokens, ans);
        } else if (tokens[1] === '-p') {
          const projectId = tokens[2];
          const ans = await deleteProject(projectId);
          console.log(tokens, ans);
        } else {
          console.log('Sorry I didn\'t understand that', tokens);
        }
      } else if (tokens[0] === 'display') {
        if (tokens[1] === '-e') {
          console.log(tokens);
          console.log(allEmployees());
        } else if (tokens[1] === '-p') {
          console.log(allProjects());
        } else if (tokens[1] === '-t') {
          console.log(tokens);
          console.log(allTasks());
        } else {
          console.log('Sorry I didn\'t understand that', tokens);
        }
      } else if (tokens[0] === 'displayTasks' && tokens[1] === '-p') {
        const projectId = tokens[2];
        console.log(tokens);
        displayProjectTasks(projectId);
      } else if (tokens[0] === 'days') {
        const projectIds = _.tail(tokens);
        const days = getDays(projectIds);
        console.log(tokens, days);
      } else {
        console.log('Sorry I didn\'t understand that', tokens);
      }
      console.log(menu);
    });
  })
  .catch(error => {
    console.log('Error', error);
  });
