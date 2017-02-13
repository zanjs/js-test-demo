基于 Promise 的简单流程控制框架


著名的异步框架 [async](http://caolan.github.io/async/) 
中有一个 waterfall 方法（官方示例），

该方法用于控制异步的流程非常直观而且方便，就像下面这样：

```js
async.waterfall([  
    function Task1(callback) {
        callback(null, 'a');
    },
    function Task2(last, callback) {
        // last now equals 'a'
        callback(null, 'b');
    },
    function Task3(last, callback) {
        // last now equals 'b'
        callback(null, 'done');
    }
], function (err, result) {
    // result now equals 'done'
});
```


整个过程写下来就像瀑布一样，参数逐步传递，从上而下，行云流水。
如果使用 Promise 实现，可以消除掉丑陋的 callback，
伟大的 Github 上也有[现成的实现](https://github.com/notjrbauer/promise.waterfall)。
本文可不是为了介绍这两个库，而是要在这基础上更进一步。


上面的流程，大致可以用如下示意图表示：

![](http://self-storage.b0.upaiyun.com/2017/02/10/148673961632909238.png)


可是如果要实现下图的流程：

![](http://self-storage.b0.upaiyun.com/2017/02/10/148673957560530273.png)


1. Task1 执行返回 a

2. Task2_1、Task2_2、Task2_3 并行执行
    - Task2_1 收到 a 返回 b1;
    - Task2_2 收到 a 执行返回 b2；
        - Task3 在 Task2_2 执行结束后收到 b2 执行返回 c；
    - Task2_3 收到 a 返回 b3;

3. Task4 收到上一步的 [b1, c, b3] 执行。


是不是感觉有点力不从心了，没事，

`async.waterfall` 结合 `async.parallel` 一起还是能达到目的：

```js
async.waterfall([  
    function Task1(callback) {
        callback(null, 'a');
    },
    function(last, callback) {
        // last equals 'a'
        async.parallel([
            function Task2_1(callback) {
                // last equals 'a'
                callback(null, 'b1');
            },
            function(callback) {
                async.waterfall([
                    function Task2_2(callback) {
                        // last equals 'a'
                        callback(null, 'b2');
                    },
                    function Task3(last, callback) {
                        // last equals 'b2'
                        callback(null, 'c');
                    }
                ], callback);
            },
            function Task2_3(callback) {
                // last equals 'a'
                callback(null, 'b3');
            }
        ], callback);
    },
    function Task4(last, callback) {
        // last equals ['b1', 'c', 'b3']
        callback(null, 'd');
    }
], function(err, result) {
    // result equals 'd'
});
```


简直叹为观止，但愿这段代码的嵌套以及各种 `last` 和 `callback` 没有让你眩晕。
如果有一个简单的流程控制框架可以像下面这样简便地实现这个流程：

```js
new Flow([  
    function Task1() {
        return 'a';
    },
    [
        function Task2_1(last) {
            // last equals 'a'
            return 'b1';
        },
        new Flow([
            function Taks2_2(last) {
                // last equals 'a'
                return 'b2';
            },
            function Task3(last) {
                // last equals 'b2'
                return 'c';
            }
        ]),
        function Task2_3(last) {
            // last equals 'a'
            return 'b3';
        }
    ],
    function Task4(last) {
        // last equals ['b1', 'c', 'b3']
        console.log(last);
    }
]).start();
```

这样看上去是不是舒服多啦。不过非常遗憾，
在写这篇文章前还没有出现这样的一个框架。感觉被耍，别着急，我们自己撸一个便是。

### Talk is cheap, Let's 撸.

以下代码自豪地使用 `TypeScript` 编写（ps: 使用 vscode 写 typescript，真的爽到不要不要的）


为简单起见，使用 [bluebird](http://bluebirdjs.com/)，而不是原生的 `Promise`；

```
import * as Promise from 'bluebird';  
```

定义 `Task` 的类型，支持普通 `Function` 对象，`Flow` 对象和数组；

```ts
type Task = Function | Flow | Array<Function | Flow>;  
```

定义 Flow 类；

```ts
export class Flow {  
    // 保存上一个 Task 的返回值
    private lastValue: any;

    // 指向子 Flow 的父 Flow
    public parent: Flow = null;

    // Flow 的构造方法，接收 Tasks
    constructor(protected tasks: Array<Task> = []) {
        if (!(this instanceof Flow)) {
            return new Flow(tasks);
        }
    }

    // 开始 Flow 中的 tasks
    start(initValue: any = Promise.resolve()) : Promise<any> {
        // 逐个执行每一个任务
        return Promise.reduce(this.tasks, (last, curr) => {
            return this.exec(curr, last);
        }, initValue);
    }
}

```

Flow 中的 exec 方法；

```ts
protected exec(task: Task, last: any) {
        this.lastValue = last;

        // 执行每个单一 task
        let single = (t) => {
            if (t instanceof Flow) {
                // task 为 Flow 对象，既是一个子 Flow
                // 指定 parent 为当前 Flow
                t.parent = this;

                // 开始子 Flow
                return t.start(last);
            } else {
                // task 为普通方法
                return t.call(this, last);
            }
        }

        if (Array.isArray(task)) {
            // task 是数组
            // 并行执行每一个 task
            return Promise.map(task, function(it) {
                return single(it);
            });
        } else {
            return single(task);
        }
    }
```


到此为止，我们的 `Flow` 框架已经完成了。
另外可以添加两个方法，用于外部向 `flow` 实例中添加新的 `task`；

```ts
// 往后追加 task
append(...tasks: Array<Task>) {
    this.tasks = this.tasks.concat(tasks);

    return this;
}

// 往前添加 task
prepend(...tasks: Array<Task>) {
    this.tasks = tasks.concat(this.tasks);

    return this;
}
```


框架完成了，现在看看实际的应用吧，就来写一个前阵子很火的面试题 `LazyMan`：

```ts
import * as Promise from 'bluebird';  
import {Flow} from '../flow';

class LazyMan extends Flow {
    constructor(name: string){
        super([function(){
            console.log('Hi,I am %s',name);
        }])
        process.nextTick(()=> this.start());
    }

    sleep(second: number){
        return this.append(function(){
            return new Promise((resolve,reject) =>{
                setTimeout(()=> {
                    console.log('wake up after %ds !', second)
                }, second *1000)
            })
        })
    }

    sleepFirst(second: number) {
        return this.prepend(function(){
            return new Promise((resolve, reject) => {
                setTimeout(()=>{
                    console.log('wake up after %ds !', second)
                }, second * 1000)
            })
        })
    }

    eat(food: string){
        return this.append(function(){
            console.log('Eat %s ~', food)
        })
    }
}

new LazyMan('mapping').sleep(2).eat('apple').sleepFirst(5)
// Wake up after 5s!
// Hi, I am mapping
// Wake up after 2s!
// Eat apple ~
```