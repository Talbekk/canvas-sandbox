import { ChangeEvent, FunctionComponent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

type ElementObject = {
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'line' | 'square' | 'text';
    mouseOffsetX?: number;
    mouseOffsetY?: number;
    position?: string | null;
    text?: string;
}

type Coordinates = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    mouseOffsetX?: number;
    mouseOffsetY?: number;
}

type ActionStatus = 'none' | 'drawing' | 'moving' | 'resizing' | 'writing';

const distance = (a: {x: number, y: number}, b: {x: number, y: number}) => {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

const nearPoint = (x: number, y: number, x1: number, y1: number, positionName: string) => {
    return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? positionName : null;
}

const positionWithinElement = (x: number, y: number, element: ElementObject): string | null => {
    const { type, x1, y1, x2, y2 } = element; 
    if(type === 'square') {
        const topLeft = nearPoint(x, y, x1, y1, 'tl');
        const topRight = nearPoint(x, y, x2, y1, 'tr');
        const bottomLeft = nearPoint(x, y, x1, y2, 'bl');
        const bottomRight = nearPoint(x, y, x2, y2, 'br');
        const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? 'inside' : null;
        const result = topLeft || topRight || bottomLeft || bottomRight || inside;
        return result;
    } else {
        const a = { x: x1, y: y1 };
        const b = { x: x2, y: y2 };
        const c = { x, y };
        const offset = distance(a, b) - (distance(a, c) + distance(b, c));
        const start = nearPoint(x, y, x1, y1, 'start');
        const end = nearPoint(x, y, x2, y2, 'end');
        const inside = Math.abs(offset) < 1 ? 'inside' : null;
        const result = start || end || inside;
        return result;
    }
}

const getElementAtPosition = (x: number, y: number, elements: Array<ElementObject>): ElementObject | undefined => {
    const mappedResults = elements.map((element: ElementObject) => {
        const position = positionWithinElement(x, y, element);
        return {...element, position}});
    return mappedResults.find((element: ElementObject) => element.position !== null);
}

const createElement = (id: number, x1: number, y1: number, x2: number, y2: number, selectedTool: ElementObject['type']): ElementObject => {
    if(selectedTool === 'text') {
        return { id, type: selectedTool, x1, y1, x2, y2, text: "" }
    }
    return {id, x1, y1, x2, y2, type: selectedTool};
}

const updateElement = (id: number, x1: number, y1: number, x2: number, y2: number, type: ElementObject['type'], elements: Array<ElementObject>, setElements: (elements: Array<ElementObject>) => void) => {
    const updatedElement = createElement(id, x1, y1, x2, y2, type);
    const updatedElements = [...elements];
    updatedElements[id] = updatedElement;
    setElements(updatedElements);
}

const adjustElementCoordinates = (element: ElementObject) => {
    const { type, x1, y1, x2, y2} = element;
    if(type === 'square') {
        const minX: number = Math.min(x1, x2);
        const maxX: number = Math.max(x1, x2);
        const minY: number = Math.min(y1, y2);
        const maxY: number = Math.max(y1, y2);
        return {x1: minX, y1: minY, x2: maxX, y2: maxY};
    } else {
        if(x1 < x2 || (x1 === x2 && y1 < y2)) {
            return {x1, y1, x2, y2};
        } else {
            return {x1: x2, y1: y2, x2: x1, y2: y1};
        }

    }
}

const resizedCoordinates = (x: number, y: number, position: string | null, coordinates: Coordinates) => {
    const { x1, x2, y1, y2 } = coordinates;
    switch (position) {
        case 'tl':
        case "start":
            return { x1: x, y1: y, x2, y2 };
        case "tr":
            return { x1, y1: y, x2: x, y2 };
        case "bl":
            return { x1: x, y1, x2, y2: y };
        case "br":
        case "end":
            return { x1, y1, x2: x, y2: y };
        default:
            return { x1, x2, y1, y2 };
    }
}
  

const createLineElement = (element: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.moveTo(element.x1, element.y1);
    ctx.lineTo(element.x2, element.y2);
    ctx.stroke();
}

const createSquareElement = (element: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.strokeRect(element.x1, element.y1, (element.x2 - element.x1), (element.y2 - element.y1));
}

const createTextElement = (element: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.font = "24px sans-serif";
    ctx.fillText(element.text || "", element.x1, element.y1);
}

const cursorForPosition = (position?: ElementObject['position']) => {
    if(!position) return 'move';
    switch (position) {
        case 'tl':
        case 'br':
        case 'start':
        case 'end':
            return 'nwse-resize';
        case 'tr':
        case 'bl':
            return 'nesw-resize';
        default:
            return 'move';
    }
}

export const DrawingCanvas: FunctionComponent = () => {

    const [ elements, setElements ] = useState<Array<ElementObject>>([]);
    const [ action, setAction ] = useState<ActionStatus>('none');
    const [ selectedTool, setSelectedTool ] = useState<'line' | 'square' | 'selection' | 'text'>('line');
    const [ selectedElement, setSelectedElement ] = useState<ElementObject | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if(elements.length) {
                ctx.save();
                elements.forEach((element: ElementObject) => {
                    switch (element.type) {
                        case 'line':
                            createLineElement(element, ctx);
                            break;
                        case 'square':
                            createSquareElement(element, ctx);
                            break;
                        case 'text':
                            createTextElement(element, ctx);
                            break;
                        default:
                            createLineElement(element, ctx);
                            break;
                    }
                });
                ctx.restore();
            }
        }
    }, [elements, selectedTool]);

    useEffect(() => {
        const textArea = textAreaRef.current;
        if(action === 'writing') {
            textArea?.focus();
        }
    }, [action]);

    const resetCanvas = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setElements([]);
            setSelectedElement(null);
        }
    }, []);

    const handleMouseDown = useCallback((event: MouseEvent) => {
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedTool === 'selection') {
            const element: ElementObject | undefined = getElementAtPosition(offsetX, offsetY, elements);
            if(element){
                const mouseOffsetX: number = offsetX - element.x1;
                const mouseOffsetY: number = offsetY - element.y1;
                setSelectedElement({...element, mouseOffsetX, mouseOffsetY});
                if(element.position && element.position === 'inside'){
                    setAction('moving');
                }
                else {
                    setAction('resizing');
                }
            }
        } else {
            const element: ElementObject = createElement(elements.length, offsetX, offsetY, offsetX, offsetY, selectedTool);
            setElements([...elements, element]);
            setSelectedElement(element);
            setAction((element.type === 'text') ? 'writing' : 'drawing');
        }
    }, [elements, selectedTool]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        const { offsetX, offsetY } = event.nativeEvent;

        if(selectedTool === 'selection' && event.target instanceof HTMLElement) {
            const element = getElementAtPosition(offsetX, offsetY, elements);
            event.target.style.cursor = element ? cursorForPosition(element.position) : 'default';
        }

        if(action === 'drawing' && selectedTool !== 'selection') {
            const index: number = elements.length -1;
            const {x1, y1} = elements[index];
            updateElement(index, x1, y1, offsetX, offsetY, selectedTool, elements, setElements);
        } else if (action === 'moving' && selectedElement) {
            const { id, x1, y1, x2, y2, type, mouseOffsetX, mouseOffsetY } = selectedElement;
            const width: number = x2 - x1;
            const height: number = y2 - y1;
            const updatedOffsetX: number = (mouseOffsetX) ? offsetX - mouseOffsetX : offsetX;
            const updatedOffsetY: number = (mouseOffsetY) ? offsetY - mouseOffsetY : offsetY;
            updateElement(id, updatedOffsetX, updatedOffsetY, updatedOffsetX + width, updatedOffsetY + height, type, elements, setElements);
        } else if(action === 'resizing' && selectedElement) {
            const { id, type, position, ...coordinates } = selectedElement;
            const {x1, x2, y1, y2} = resizedCoordinates(offsetX, offsetY, position || null, coordinates);
            updateElement(id, x1, y1, x2, y2, type, elements, setElements);
        }
    }, [action, elements, selectedElement, selectedTool]);

    const handleMouseUp = useCallback((event: MouseEvent) => {
        const index: number = selectedElement?.id || elements.length-1;
        const {id, type} = elements[index];
        if( action === 'drawing' || action === 'resizing') {
           const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
           updateElement(id, x1, y1, x2, y2, type, elements, setElements)
        }
        if(action !== 'writing') {
            setSelectedElement(null);
            setAction('none');
        }
    }, [action, elements, selectedElement?.id]);

    const handleElementSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedTool(event.target.value as ElementObject['type']);
    }, []);

    return (
        <section className={styles.drawingCanvasSection}>
            {(action === 'writing' && selectedElement) ? <textarea ref={textAreaRef} style={{position: 'relative', width: '150px', top: selectedElement?.y1, left: selectedElement?.x1, zIndex: 1}}/> : null}
            <canvas id="certificates-canvas" className={styles.drawingCanvasContainer} height="500" width="500" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                Custom certificate
            </canvas>
            <div className={styles.actionButtonRow}>
            <label htmlFor="drawing-element-select" className={styles.drawingElementSelectField}>
                    Action:
                <select id="drawing-element-select" onChange={handleElementSelect}>
                    <option value='line'>Line</option>
                    <option value='square'>Square</option>
                    <option value='selection'>Selection</option>
                    <option value='text'>Text</option>
                </select>
                </label>
                <button onClick={resetCanvas}>Reset</button>
            </div>
        </section>
    );
};
