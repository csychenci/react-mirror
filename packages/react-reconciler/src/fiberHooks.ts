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
	Update,
	UpdateQueue
} from './updateQueue';
import {
	Action,
	ReactContext
} from 'shared/ReactType';
import { scheduleUpdateOnFiber } from './workLoop';
import {
	requestUpdateLane,
	Lane,
	NoLane
} from './fiberLanes';
import {
	Flags,
	PassiveEffect
} from './fiberFlags';
import {
	HookHasEffect,
	Passive
} from './hookEffectTags';
import currentBatchConfig from 'react/src/currentBatchConfig';

let currentlyRenderingFiber: FiberNode | null =
	null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;
const { currentDispatcher } = internals;

interface Hook {
	// 保存的 hook 自身的数据
	memoizedState: any;
	// 更新队列
	updateQueue: unknown;
	// 指向下一个 hook
	next: Hook | null;
	baseState: any;
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface FCUpdateQueue<State>
	extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

export function renderWithHooks(
	wip: FiberNode,
	lane: Lane
) {
	// 设置当前正在渲染的fiber
	currentlyRenderingFiber = wip;
	// 重置 hooks 链表
	wip.memoizedState = null;
	// 重置 effect 连标
	wip.updateQueue = null;
	renderLane = lane;
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
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef,
	useContext: readContext
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef,
	useContext: readContext
};

function mountEffect(
	create: EffectCallback | void,
	deps: EffectDeps | void
) {
	const hook = mountWorkInProgressHook();
	const nextDeps =
		deps === undefined ? null : deps;
	(currentlyRenderingFiber as FiberNode).flags |=
		PassiveEffect;
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(
	create: EffectCallback | void,
	deps: EffectDeps | void
) {
	const hook = updateWorkInProgressHook();
	const nextDeps =
		deps === undefined ? null : deps;
	let destroy: EffectCallback | void;
	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState;
		destroy = prevEffect.destroy;
		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (
				areHookInputsEqual(nextDeps, prevDeps)
			) {
				hook.memoizedState = pushEffect(
					Passive,
					create,
					destroy,
					nextDeps
				);
				return;
			}
		}
		// 浅比较 不相等
		(
			currentlyRenderingFiber as FiberNode
		).flags |= PassiveEffect;
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}

function areHookInputsEqual(
	nextDeps: EffectDeps,
	prevDeps: EffectDeps
) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (
		let i = 0;
		i < prevDeps.length && i < nextDeps.length;
		i++
	) {
		if (Object.is(nextDeps[i], prevDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
) {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};
	const fiber =
		currentlyRenderingFiber as FiberNode;
	const updateQueue =
		fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue =
		createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function updateState<State>(): [
	State,
	Dispatch<State>
] {
	// 找到当前 useState 对应的 hook 数据
	const hook = updateWorkInProgressHook();
	const queue =
		hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	const baseState = hook.baseState;
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	if (pending !== null) {
		// pending baseQueue update 保存到 current 中
		if (baseQueue !== null) {
			// baseQueue: b2 -> b1 -> b0 -> b2
			// pending: p2 -> p0 -> p1 -> p2
			const baseFirst = baseQueue.next;
			const pendingFirst = pending.next;
			baseQueue.next = pendingFirst;
			// b2 -> p0 -> p1 -> p2
			pending.next = baseFirst;
			// p2 -> b0 -> b1 -> b2
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}

		baseQueue = pending;
		current.baseQueue = pending;
		// 保存到 current 中
		queue.shared.pending = null;
	}

	if (baseQueue !== null) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(
			baseState,
			baseQueue,
			renderLane
		);
		hook.memoizedState = memoizedState;
		hook.baseQueue = newBaseQueue;
		hook.baseState = newBaseState;
	}

	return [
		hook.memoizedState,
		queue.dispatch as Dispatch<State>
	];
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
	hook.baseState = memoizedState;
	const dispatch = dispatchSetState.bind(
		null,
		// @ts-ignore
		currentlyRenderingFiber,
		queue
	);
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

function mountTransition(): [
	boolean,
	(callback: () => void) => void
] {
	const [isPending, setIsPending] =
		mountState(false);
	const hook = mountWorkInProgressHook();
	const start = startTransition.bind(
		null,
		setIsPending
	);
	hook.memoizedState = start;
	return [isPending, hook.memoizedState];
}

function updateTransition(): [
	boolean,
	(callback: () => void) => void
] {
	const [isPending] = updateState();
	const hook = updateWorkInProgressHook();
	const start = hook.memoizedState;
	return [isPending as boolean, start];
}

function startTransition(
	setPending: Dispatch<boolean>,
	callback: () => void
) {
	/** 触发一次高优先级的更新 */
	setPending(true);
	/** 记录之前的 transition 状态(可能是 null) */
	const prevTransition =
		currentBatchConfig.transition;
	/** 记录当前正处于过渡中，后续的更新将使用 TransitonLane 的优先级 */
	currentBatchConfig.transition = 1;
	callback();
	setPending(false);
	/** 过渡完成以后，还原之前的 transition 状态 */
	currentBatchConfig.transition = prevTransition;
}

function mountRef<T>(initialValue: T): {
	current: T;
} {
	const hook = mountWorkInProgressHook();
	const ref = { current: initialValue };
	hook.memoizedState = ref;
	return ref;
}

function updateRef<T>(initialValue: T): {
	current: T;
} {
	const hook = updateWorkInProgressHook();
	return hook.memoizedState;
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	console.log('update', lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseState: null,
		baseQueue: null
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
		const current =
			currentlyRenderingFiber?.alternate;
		/**
		 *  current 是 currentlyRenderingFiber 的 currentFiber
		 *  1. 如果 current 为 null，说明是 mount 阶段，
		 * 	   但是这是 update 阶段，所以不应该进入到这里，这里是处理一些错误的边界情况
		 *  2. 如果 current 不为 null，则取得 current 的 memoizedState
		 */
		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		// 这是 fc update 时的后续 hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		/**
		 * mount/update: useState1、useState2、useState3
		 * 本次 update :useState1、useState2、useState3、useState4(if 中的 hook)
		 * 在本次更新中，currentHook 指向 useState3，而 currentHook.next 指向是 null
		 * 这种情况下应该报错
		 */
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次多`
		);
	}

	currentHook = nextCurrentHook;

	const newHook: Hook = {
		memoizedState: currentHook?.memoizedState,
		updateQueue: currentHook?.updateQueue,
		next: null,
		baseQueue: currentHook?.baseQueue,
		baseState: currentHook?.baseState
	};

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

	return workInProgressHook;
}

function readContext<T>(
	context: ReactContext<T>
): T {
	const consumer = currentlyRenderingFiber;
	if (consumer === null) {
		throw new Error(
			'useContext 必须在函数组件中调用'
		);
	}
	const value = context._currentValue;
	return value;
}
