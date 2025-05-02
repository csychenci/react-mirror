import {
	Props,
	ReactElementType
} from 'shared/ReactType';
import {
	createFiberFromElement,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import {
	ChildDeletion,
	Placement
} from './fiberFlags';

function ChildReconciler(
	shouldTrackSideEffects: boolean
) {
	function deleteChild(
		returnFiber: FiberNode,
		childToDelete: FiberNode
	) {
		if (!shouldTrackSideEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstFiber: FiberNode | null
	) {
		if (!shouldTrackSideEffects) {
			return;
		}
		let childToDelete = currentFirstFiber;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				if (
					element.$$typeof === REACT_ELEMENT_TYPE
				) {
					if (
						currentFiber.type === element.type
					) {
						// type 相同，可以复用
						const existing = useFiber(
							currentFiber,
							element.props
						);
						existing.return = returnFiber;
						// 当前节点可复用，剩余节点标记为删除
						deleteRemainingChildren(
							returnFiber,
							currentFiber.sibling
						);
						return existing;
					}
					// key 相同，type 不同，删掉所有旧的
					deleteRemainingChildren(
						returnFiber,
						currentFiber
					);
					break;
				} else {
					if (__DEV__) {
						console.warn(
							'未实现的react类型',
							element
						);
						break;
					}
				}
			} else {
				// key 不同，删除当前节点
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		// 根据 element 创建 fiber
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, {
					content
				});
				existing.return = returnFiber;
				// 当前节点可复用，剩余节点标记为删除
				deleteRemainingChildren(
					returnFiber,
					currentFiber.sibling
				);
				return existing;
			}
			// <div>123</div> -> 123
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}
		const fiber = new FiberNode(
			HostText,
			{ content },
			null
		);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (
			shouldTrackSideEffects &&
			fiber.alternate === null
		) {
			// shouldTrackSideEffects： 应该追逐副作用
			// fiber.alternate === null： 当前是首屏渲染的情况
			fiber.flags = Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		if (
			typeof newChild === 'object' &&
			newChild !== null
		) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(
							returnFiber,
							currentFiber,
							newChild
						)
					);
				default:
					if (__DEV__) {
						console.warn(
							'未实现的reconcile类型',
							newChild
						);
					}
					break;
			}
		}

		if (
			typeof newChild === 'string' ||
			typeof newChild === 'number'
		) {
			// 文本节点
			return placeSingleChild(
				reconcileSingleTextNode(
					returnFiber,
					currentFiber,
					newChild
				)
			);
		}

		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn(
				'未实现的reconcile类型',
				newChild
			);
		}
		return null;
	};
}

function useFiber(
	fiber: FiberNode,
	pendingProps: Props
): FiberNode {
	const clone = createWorkInProgress(
		fiber,
		pendingProps
	);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

export const reconcileChildFibers =
	ChildReconciler(true);
export const mountChildFibers =
	ChildReconciler(false);
