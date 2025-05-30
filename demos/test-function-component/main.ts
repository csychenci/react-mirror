import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_LowPriority as LowPriority,
  unstable_IdlePriority as IdlePriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
  CallbackNode,
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_cancelCallback as cancelCallback
} from 'scheduler';
const root = document.querySelector('#root');

type Priority =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

interface Work {
  count: number;
  priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

function schedule() {
  const cbNode = getFirstCallbackNode();
  const currentWork = workList.sort(
    (a, b) => a.priority - b.priority
  )[0];

  // 策略逻辑
  // 1. worklist 为空，不需要在调度了
  if (!currentWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }

  const { priority: currentPriority } = currentWork;

  // 2. 如果当前的优先级和上一次的优先级一样，则不需要调度
  if (currentPriority === prevPriority) {
    return;
  }

  // 3. 更高优先级的 work，取消之前的调度，重新调度
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(
    currentPriority,
    perform.bind(null, currentWork),
    {
      delay: 0
    }
  );
}

function perform(work: Work, didTimeout?: boolean): any {

  const needSync = work.priority === ImmediatePriority || didTimeout;
  while ((needSync || !shouldYield()) && work.count) {
    work.count--
    insertSpan(work.priority + "");
  }

  // 中断执行或者执行完毕
  // 更新 prevPriority 为当前 work 的 priority
  prevPriority = work.priority;
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    // 当前 work 结束了，重置 prevPriority
    prevPriority = IdlePriority;
  }
  const prevCallback = curCallback;
  schedule();
  const newCallback = curCallback;
  if (newCallback && newCallback === prevCallback) {
    // 如果新的 callback 和之前的 callback 不一样，则取消之前的 callback
    return perform.bind(null, work);
  }
}

function insertSpan(content: string | number) {
  const span = document.createElement('span');
  span.innerText = `${content}`;
  span.className = `priority-${content}`;
  doSomeBuzyWork(100000);
  root?.appendChild(span);
}

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach((priority, index) => {
  const btn = document.createElement('button');
  root?.appendChild(btn);
  btn.innerText = ['', 'ImmediatePriority', 'UserBlockingPriority', 'NormalPriority', 'LowPriority'][priority];
  btn.onclick = () => {
    workList.unshift({
      count: 100,
      priority: priority as Priority
    });
    schedule();
  }
});

function doSomeBuzyWork(len: number) {
  let result = 0;
  while (len--) {
    result += len
  }
  return result;
}
