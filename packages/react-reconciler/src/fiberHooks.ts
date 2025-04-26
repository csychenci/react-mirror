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
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactType';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null =
	null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
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
		currentDispatcher.current =
			HooksDispatcherOnUpdate;
	} else {
		currentDispatcher.current =
			HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);
	// 重置当前正在渲染的fiber
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

function updateState<State>(
): [State, Dispatch<State>] {
	// 找到当前 useState 对应的 hook 数据
	const hook = updateWorkInProgressHook();
	const queue = hook.updateQueue as UpdateQueue<State>,
		pending = queue.shared.pending;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending)
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

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
	const dispatch = dispatchSetState.bind(
		null,
		// @ts-ignore
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

function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | null = null;
	if (currentHook === null) {
		// 这是 fc update 时的第一个 hook
		const current = currentlyRenderingFiber?.alternate
		/**
			 *  current 是 currentlyRenderingFiber 的 currentFiber
			 *  1. 如果 current 为 null，说明是 mount 阶段，
			 * 	   但是这是 update 阶段，所以不应该进入到这里，这里是处理一些错误的边界情况
			 *  2. 如果 current 不为 null，则取得 current 的 memoizedState
			*/
		if (current !== null) {
			nextCurrentHook = current?.memoizedState
		} else {
			nextCurrentHook = null
		}
	} else {
		// 这是 fc update 时的后续 hook
		nextCurrentHook = currentHook.next
	}

	if (nextCurrentHook === null) {
		/**
		 * mount/update: useState1、useState2、useState3
		 * 本次 update :useState1、useState2、useState3、useState4(if 中的 hook)
		 * 在本次更新中，currentHook 指向 useState3，而 currentHook.next 指向是 null
		 * 这种情况下应该报错
		 */
		throw new Error(`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次多`)
	}

	currentHook = nextCurrentHook

	const newHook: Hook = {
		memoizedState: currentHook?.memoizedState,
		updateQueue: currentHook?.updateQueue,
		next: null
	}

	if (workInProgressHook === null) {
		// mount时并且是第一个 hook
		if (currentlyRenderingFiber === null) {
			// 说明不是在函数组件中调用
			throw new Error('hook必须在函数组件中调用');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState =
				workInProgressHook;
		}
	} else {
		// mount 时后续的 hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook
}
