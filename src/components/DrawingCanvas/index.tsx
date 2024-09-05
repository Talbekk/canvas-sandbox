import { ChangeEvent, FocusEvent, FunctionComponent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

type ElementObject = {
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'square' | 'text';
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

const nearPoint = (x: number, y: number, x1: number, y1: number, positionName: string) => {
    return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? positionName : null;
}

const positionWithinElement = (x: number, y: number, element: ElementObject): string | null => {
    const { type, x1, y1, x2, y2 } = element; 
    if(type === 'square') {
        const topLeft = nearPoint(x, y, x1, y1, 'top-left');
        const topRight = nearPoint(x, y, x2, y1, 'top-right');
        const bottomLeft = nearPoint(x, y, x1, y2, 'bottom-left');
        const bottomRight = nearPoint(x, y, x2, y2, 'bottom-right');
        const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? 'inside' : null;
        return topLeft || topRight || bottomLeft || bottomRight || inside;
    } else {
        return  x >= x1 && x <= x2 && y >= y1 && y <= y2 ? 'inside' : null;
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

const updateElement = (id: number, x1: number, y1: number, x2: number, y2: number, type: ElementObject['type'], elements: Array<ElementObject>, setElements: (elements: Array<ElementObject>) => void, options?: {[key: string]: any}) => {
    const updatedElements = [...elements];
    switch (type) {
        case 'square':
            updatedElements[id] = createElement(id, x1, y1, x2, y2, type);
            break;
        case 'text':
            const canvas: any = document.getElementById('certificates-canvas');
            if (canvas?.getContext && options) {
                const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
                const textWidth = ctx.measureText(options.text).width;
                const textHeight = 24;
                updatedElements[id] = {
                    ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type),
                    text: options.text,
                };
            }
            break;
        default:
            throw new Error(`Type not recognised: ${type}`);
    }
    setElements(updatedElements);
}

const adjustElementCoordinates = (element: ElementObject) => {
    const { x1, y1, x2, y2} = element;
    const minX: number = Math.min(x1, x2);
    const maxX: number = Math.max(x1, x2);
    const minY: number = Math.min(y1, y2);
    const maxY: number = Math.max(y1, y2);
    return {x1: minX, y1: minY, x2: maxX, y2: maxY};
}

const resizedCoordinates = (x: number, y: number, position: string | null, coordinates: Coordinates) => {
    console.log("hits resize coordinates");
    const { x1, x2, y1, y2 } = coordinates;
    switch (position) {
        case 'top-left':
        case "start":
            return { x1: x, y1: y, x2, y2 };
        case "top-right":
            return { x1, y1: y, x2: x, y2 };
        case "bottom-left":
            return { x1: x, y1, x2, y2: y };
        case "bottom-right":
        case "end":
            return { x1, y1, x2: x, y2: y };
        default:
            return { x1, x2, y1, y2 };
    }
}

const createSquareElement = (element: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.strokeRect(element.x1, element.y1, (element.x2 - element.x1), (element.y2 - element.y1));
}

const createTextElement = (element: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.textBaseline = 'top';
    ctx.font = "24px sans-serif";
    ctx.fillText(element.text || "", element.x1, element.y1);
}

const cursorForPosition = (position?: ElementObject['position']) => {
    if(!position) return 'move';
    switch (position) {
        case 'top-left':
        case 'bottom-right':
        case 'start':
        case 'end':
            return 'nwse-resize';
        case 'top-right':
        case 'bottom-left':
            return 'nesw-resize';
        default:
            return 'move';
    }
}

export const DrawingCanvas: FunctionComponent = () => {

    const [ elements, setElements ] = useState<Array<ElementObject>>([]);
    const [ action, setAction ] = useState<ActionStatus>('none');
    const [ selectedTool, setSelectedTool ] = useState< 'square' | 'selection' | 'text'>('square');
    const [ selectedElement, setSelectedElement ] = useState<ElementObject | null>(null);
    const textAreaRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if(elements.length) {
                ctx.save();
                elements.forEach((element: ElementObject) => {
                    if(action === 'writing' && selectedElement?.id === element.id) return;
                    switch (element.type) {
                        case 'square':
                            createSquareElement(element, ctx);
                            break;
                        case 'text':
                            createTextElement(element, ctx);
                            break;
                        default:
                            createSquareElement(element, ctx);
                            break;
                    }
                });
                ctx.restore();
            }
        }
    }, [action, elements, selectedElement?.id, selectedTool]);

    useEffect(() => {
        const textArea = textAreaRef.current;
        if (action === "writing" && textArea) {
            setTimeout(() => {
              textArea.focus();
              textArea.value = selectedElement?.text || "";
            }, 0);
          }
    }, [action, textAreaRef, selectedElement, selectedElement?.id]);

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
        console.log(`event: `, event);
        if(action === 'writing') return;
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
    }, [action, elements, selectedTool]);

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
            const options = (type === 'text') ? { text: selectedElement.text} : {};
            updateElement(id, updatedOffsetX, updatedOffsetY, updatedOffsetX + width, updatedOffsetY + height, type, elements, setElements, options);
        } else if(action === 'resizing' && selectedElement) {
            const { id, type, position, ...coordinates } = selectedElement;
            let options = (type === 'text') ? { text: selectedElement.text} : {};
            const {x1, x2, y1, y2} = resizedCoordinates(offsetX, offsetY, position || null, coordinates);
            updateElement(id, x1, y1, x2, y2, type, elements, setElements, options);
        }
    }, [action, elements, selectedElement, selectedTool]);

    const handleMouseUp = useCallback((event: any) => {
        console.log(`event: `, event);
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedElement && selectedElement.mouseOffsetX && selectedElement.mouseOffsetY) {
            if(selectedElement.type === 'text' && offsetX - selectedElement.mouseOffsetX === selectedElement.x1 && offsetY - selectedElement.mouseOffsetY === selectedElement.y1) {
                setAction('writing');
                return;
            }
            const index: number = selectedElement.id;
            const {id, type} = elements[index];
            if( action === 'drawing' || action === 'resizing') {
               const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
               updateElement(id, x1, y1, x2, y2, type, elements, setElements);
            }
        }
        if(action !== 'writing') {
            setSelectedElement(null);
            setAction('none');
        }
    }, [action, elements, selectedElement]);

    const handleElementSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedTool(event.target.value as ElementObject['type']);
    }, []);

    const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
        if(selectedElement) {
            const { id, x1, y1, x2, y2, type } = selectedElement;
            setSelectedElement(null);
            updateElement(id, x1, y1, x2, y2, type, elements, setElements, { text: event.target.value });
        }
        setAction('none');
    }, [elements, selectedElement]);

    return (
        <section className={styles.drawingCanvasSection}>
            {(action === 'writing' && selectedElement) ? 
            <div 
                style={{     
                    width: '100%',
                    position: 'absolute', 
                    top: selectedElement.y1 - 25, 
                    left: selectedElement.x1, 
                    zIndex: 5,
                }}
            >
                <div style={{ 
                    display: 'flex',
                }}>
                    <span>Font</span>
                    <span>Size</span>
                    <span>Align</span>
                    <span>Colour</span>
                </div>
                <input 
                    id='text-area'
                    ref={textAreaRef} 
                    style={{
                        width: 'fit-content',
                        font: '24px sans-serif',
                        resize: 'none',
                        overflow: 'hidden',
                        whiteSpace: 'pre',
                        background: 'transparent',
                    }} 
                    onBlur={handleBlur} 
            /></div> : null}
            <canvas id="certificates-canvas" className={styles.drawingCanvasContainer} height="500" width="500" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} >
                Custom certificate
            </canvas>
            <div className={styles.actionButtonRow}>
            <label htmlFor="drawing-element-select" className={styles.drawingElementSelectField}>
                    Action:
                <select id="drawing-element-select" onChange={handleElementSelect}>
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
