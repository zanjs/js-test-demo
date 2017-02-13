import * as Promise from 'bluebird'

type Task = Function | Flow | Array < Function | Flow >

    export class Flow {
        private lastValue: any

        public parent: Flow = null

        constructor(protected tasks: Array < Task > = []) {
            if (!(this instanceof Flow)) {
                return new Flow(tasks)
            }
        }

        append(...tasks: Array < Task > ) {
            this.tasks = this.tasks.concat(tasks)
            return this
        }

        prepend(...tasks: Array < Task > ) {
            this.tasks = tasks.concat(this.tasks)
            return this
        }

        protected exec(task: Task, last: any) {
            this.lastValue = last;

            // executor of a single task
            let single = (t) => {
                if (t instanceof Flow) {
                    // the task is a flow instance as a child flow
                    // specify the child flow's parent to this
                    t.parent = this;

                    // start the child flow
                    return t.start(last);
                } else {
                    // the task is a function
                    // exec the function
                    return t.call(this, last);
                }
            }

            if (Array.isArray(task)) {
                // task is an array 
                // exec each task concurrently
                return Promise.map(task, function (it) {
                    return single(it);
                });
            } else {
                return single(task);
            }
        }

        start(initValue: any = Promise.resolve()): Promise < any > {
            return Promise.reduce(this.tasks, (last, curr) => {
                return this.exec(curr, last)
            }, initValue)
        }
    }