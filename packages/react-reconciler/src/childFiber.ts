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

type ExistingChildren = Map<
	string | number,
	FiberNode
>;

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

	function reconcilerChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可复用 fiber 在 current 中的 index
		let lastPlacedIndex: number = 0;
		// 创建的最后一个 fiber
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个 fiber
		let firstNewFiber: FiberNode | null = null;

		// 1. 将 current 保存到 map 中
		const existingChildren: ExistingChildren =
			new Map();
		let current = currentFirstChild;
		while (current !== null) {
			const keyToUse =
				current.key !== null
					? current?.key
					: current?.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}
		// 2. 遍历 newChild，寻找是否可复用
		for (let i = 0; i < newChild.length; i++) {
			const after = newChild[i];
			const newFiber = updateFromMap(
				returnFiber,
				existingChildren,
				i,
				after
			);

			// 不管更新之前是什么，更新后是 false、null，那么最终返回的都是 null
			if (newFiber === null) {
				continue;
			}

			// 3. 标记移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;

			if (lastNewFiber === null) {
				lastNewFiber = newFiber
				firstNewFiber = newFiber
			} else {
				lastNewFiber.sibling = newFiber
				lastNewFiber = lastNewFiber.sibling
			}

			if (!shouldTrackSideEffects) {
				continue
			}

			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue
				} else {
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount
				newFiber.flags |= Placement;
			}
		}
		// 4. 将 Map 中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse =
			element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);
		if (
			typeof element === 'string' ||
			typeof element === 'number'
		) {
			// HostText
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse);
					return useFiber(before, {
						content: element + ''
					});
				}
				return new FiberNode(HostText, { content: element + '' }, null)
			}
		}

		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse)
							return useFiber(before, element.props)
						}
					}
					return createFiberFromElement(element)
			}
			if (Array.isArray(element) && __DEV__) {
				console.warn('未实现数组类型的 child', element)
			}
		}
		return null
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
			if (Array.isArray(newChild)) {
				return reconcilerChildrenArray(
					returnFiber,
					currentFiber,
					newChild
				);
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
