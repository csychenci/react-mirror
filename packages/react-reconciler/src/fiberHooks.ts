import internals from 'shared/internals';
import { FiberNode } from './fiber';
import {
	Dispatcher,
	Dispatch
} from 'react/src/currentDispatch';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactType';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null =
	null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

interface Hook {
	// 保存的 hook 自身的数据
	memoizedState: any;
	// 更新队列
	updateQueue: unknown;
	// 指向下一个 hook
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
	// 设置当前正在渲染的fiber
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;

	const current = wip.alternate;
	if (current !== null) {
		// update
	} else {
		currentDispatcher.current =
			HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);
	// 重置当前正在渲染的fiber
	currentlyRenderingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

function mountState<State>(
	initialState: State | (() => State)
): [State, Dispatch<State>] {
	// 找到当前 useState 对应的 hook 数据
	const hook = mountWorkInProgressHook();

	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;
	// @ts-ignore
	const dispatch = dispatchSetState.bind(
		null,
		currentlyRenderingFiber,
		queue
	);
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};
	if (workInProgressHook === null) {
		// mount时并且是第一个 hook
		if (currentlyRenderingFiber === null) {
			// 说明不是在函数组件中调用
			throw new Error('hook必须在函数组件中调用');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState =
				workInProgressHook;
		}
	} else {
		// mount 时后续的 hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}
