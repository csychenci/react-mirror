import { Container } from 'hostConfig';
import { Props } from 'shared/ReactType';

export const elementPropsKey = '__props';

const validEventTypeList = ['click'];

type EventCallback = (event: Event) => void;

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

export function updateFiberProps(
	node: DOMElement,
	props: Props
) {
	node[elementPropsKey] = props;
}

export function initEvent(
	container: Container,
	evnetType: string
) {
	if (!validEventTypeList.includes(evnetType)) {
		console.warn('当前不支持', evnetType, '事件');
		return;
	}
	if (__DEV__) {
		console.warn('初始化事件', evnetType);
	}
	container.addEventListener(evnetType, (e) => {
		dispatchEvent(container, evnetType, e);
	});
}

function dispatchEvent(
	container: Container,
	evnetType: string,
	e: Event
) {
	const targetElement = e.target as DOMElement;
	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}
	// 1. 收集 targetElement => container 之间的所有的祖先 element 的同类型的事件回调
	const { bubble, capture } = collectPaths(
		targetElement,
		container,
		evnetType
	);
	// 2. 构造合成事件
	const syntheticEvent = createSyntheticEvent(e);
	// 3. 遍历 capture
	triggerEventFlow(capture, syntheticEvent);
	// 4. 遍历 bubble
	if (!syntheticEvent.__stopPropagation) {
		triggerEventFlow(bubble, syntheticEvent);
	}
}

function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	evnetType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};
	while (
		targetElement &&
		targetElement !== container
	) {
		// 收集
		const elementProps =
			targetElement[elementPropsKey];
		if (elementProps) {
			const callbackNameList =
				getEventCallbackNameFromEventType(
					evnetType
				);
			if (callbackNameList) {
				callbackNameList.forEach(
					(callbackName, index) => {
						const eventCallback =
							elementProps[callbackName];
						if (eventCallback) {
							if (index === 0) {
								paths.capture.unshift(
									eventCallback
								);
							} else {
								paths.bubble.push(eventCallback);
							}
						}
					}
				);
			}
		}
		targetElement =
			targetElement.parentNode as DOMElement;
	}

	return paths;
}

function createSyntheticEvent(e: Event) {
	const syntheticEvent: SyntheticEvent =
		e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;
	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};
	return syntheticEvent;
}

function triggerEventFlow(
	paths: EventCallback[],
	syntheticEvent: SyntheticEvent
) {
	for (let i = 0; i < paths.length; i++) {
		const eventCallback = paths[i];
		eventCallback.call(null, syntheticEvent);
		if (syntheticEvent.__stopPropagation) {
			// 如果 __stopPropagation 为 true，则阻止事件继续传播
			break;
		}
	}
}
