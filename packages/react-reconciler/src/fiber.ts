import {
	Key,
	Props,
	ReactElementType,
	Ref
} from 'shared/ReactType';
import {
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	ref: Ref;

	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;

	constructor(
		tag: WorkTag,
		pendingProps: Props,
		key: Key
	) {
		// 实例属性
		this.tag = tag;
		this.key = key;
		this.stateNode = null; // HostComponent: <div> Dom
		this.type = null; // FunctionComponent: Component () => {}

		// 构成树状结构
		this.return = null; // 指向父级 FiberNode
		this.sibling = null; // 指向右边兄弟 FiberNode
		this.child = null; // 指向子级 FiberNode
		this.index = 0; // 多个同级 fiber， 当前 fiber 在兄弟节点中的位置

		this.ref = null; // 指向 ref

		// 作为工作单元
		this.pendingProps = pendingProps; // 工作单元刚开始准备工作的时候的 props
		this.memoizedProps = null; // 工作单元完成工作后的时候的 props
		this.updateQueue = null;
		this.memoizedState = null;
		/**
		 * 用于在 fiberNode 和另一个 fiberNode 之间切换
		 * 比如说当前的 fiberNode 是 current，那么 alternate 就指向 workInProgress fiberNode
		 * 比如说当前的 fiberNode 是 workInProgress，那么 alternate 就指向 current fiberNode
		 */
		this.alternate = null;

		this.flags = NoFlags; // 副作用
		this.subtreeFlags = NoFlags; // 子树的副作用
	}
}

export class FiberRootNode {
	container: Container; // 对应的宿主环境的挂载的节点(window 下是 domElement)
	current: FiberNode; // 指向 hostRootFiber
	/**
	 * 指向更新完成(递归完成)以后的 hostRootFiber
	 */
	finishedWork: FiberNode | null;

	constructor(
		container: Container,
		hostRootFiber: FiberNode
	) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// mount
		wip = new FiberNode(
			current.tag,
			pendingProps,
			current.key
		);
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		// 清除副作用
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	return wip;
};

export function createFiberFromElement(
	element: ReactElementType
): FiberNode {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// 原生标签
		fiberTag = HostComponent;
	} else if (
		typeof type !== 'function' &&
		__DEV__
	) {
		console.warn('未定义的type', element);
	}

	const fiber = new FiberNode(
		fiberTag,
		props,
		key
	);
	fiber.type = type;
	return fiber;
}
