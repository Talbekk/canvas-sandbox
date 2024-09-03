import { ChangeEvent, FunctionComponent, MouseEvent, useCallback, useLayoutEffect, useState } from 'react';
import styles from './styles.module.css';

type ElementObject = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'line' | 'square';
}

const createElement = (x1: number, y1: number, x2: number, y2: number, selectedElement: ElementObject['type']): ElementObject => {
    return {x1, y1, x2, y2, type: selectedElement};
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

export const DrawingCanvas: FunctionComponent = () => {

    const [ elements, setElements ] = useState<Array<ElementObject>>([]);
    const [ drawing, setDrawing ] = useState<boolean>(false);
    const [ selectedElement, setSelectedElement ] = useState<ElementObject['type']>('line');

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
                        default:
                            createLineElement(element, ctx);
                            break;
                    }
                });
                ctx.restore();
            }
        }
    }, [elements, selectedElement]);

    const square = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.fillRect(125, 50, 75, 75);
        }
    }, []);

    const triangle = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.beginPath();
            ctx.moveTo(75, 50);
            ctx.lineTo(100, 75);
            ctx.lineTo(100, 25);
            ctx.fill();
        }
    }, []);

    const smile = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(75, 75, 50, 0, Math.PI * 2, true); // Outer circle
            ctx.moveTo(110, 75);
            ctx.arc(75, 75, 35, 0, Math.PI, false); // Mouth (clockwise)
            ctx.moveTo(65, 65);
            ctx.arc(60, 65, 5, 0, Math.PI * 2, true); // Left eye
            ctx.moveTo(95, 65);
            ctx.arc(90, 65, 5, 0, Math.PI * 2, true); // Right eye
            ctx.stroke();
        }
    }, []);

    const path2D = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            const rectangle = new Path2D();
            rectangle.rect(10, 10, 50, 50);

            const circle = new Path2D();
            circle.arc(100, 35, 25, 0, 2 * Math.PI);

            ctx.stroke(rectangle);
            ctx.fill(circle);
        }
    }, []);

    const line = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.beginPath();
            ctx.moveTo(283, 444);
            ctx.lineTo(344, 280);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(288, 676);
            ctx.lineTo(559, 435);
            ctx.stroke();
        }
    }, []);

    const resetCanvas = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setElements([]);
        }
    }, []);

    const handleMouseDown = useCallback((event: MouseEvent) => {
        setDrawing(true);
        const { offsetX, offsetY } = event.nativeEvent;
        const roughElement: ElementObject = createElement(offsetX, offsetY, offsetX, offsetY, selectedElement);
        setElements([...elements, roughElement]);
    }, [elements, selectedElement]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if(!drawing) return;
        const { offsetX, offsetY } = event.nativeEvent;
        const index: number = elements.length -1;
        const {x1, y1} = elements[index];
        const updatedElement = createElement(x1, y1, offsetX, offsetY, selectedElement);
        const updatedElements = [...elements];
        updatedElements[index] = updatedElement;
        setElements(updatedElements);
    }, [drawing, elements, selectedElement]);

    const handleMouseUp = useCallback((event: MouseEvent) => {
        setDrawing(false);
    }, []);

    const handleElementSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedElement(event.target.value as ElementObject['type']);
    }, []);

    return (
        <section className={styles.drawingCanvasSection}>
            <canvas id="certificates-canvas" className={styles.drawingCanvasContainer} height="500" width="500" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                Custom certificate
            </canvas>
            <div className={styles.actionButtonRow}>
                <button onClick={square}>Square</button>
                <button onClick={triangle}>Triangle</button>
                <button onClick={smile}>Smile</button>
                <button onClick={path2D}>Path2D</button>
                <button onClick={line}>Line</button>
                <button onClick={resetCanvas}>Reset</button>
            </div>
            <div className={styles.drawingRow}>
                <label className={styles.drawingElementSelectField}>
                    Drawing Element:
                <select id="drawing-element-select" onChange={handleElementSelect}>
                    <option value='line'>Line</option>
                    <option value='square'>Square</option>
                </select>
                </label>
            </div>
        </section>
    );
};
