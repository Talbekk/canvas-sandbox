import { ChangeEvent, FocusEvent, FunctionComponent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

type ElementObject = {
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'text';
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

export type Dimensions = {
    width: number;
    height: number;
};

export type Box = {
    width: number;
    height: number;
    x: number;
    y: number;
};

export type TextBlock = {
    type: 'text';
    boundingBox: Box;
    text: string;
    fontSize: number;
    fontFamily: string; // TODO We likely want a strict subset of fonts as the backend will only support so many
    color: string;
    align: 'left' | 'right' | 'center';
    verticalAlign: 'top' | 'bottom' | 'center' | 'hanging'; // TODO Is hanging a good name, this is where like the bottom of p's go under the line
};

type ActionStatus = 'none' | 'drawing' | 'moving' | 'resizing' | 'writing';

const nearPoint = (x: number, y: number, x1: number, y1: number, positionName: string) => {
    return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? positionName : null;
}

const positionWithinElement = (x: number, y: number, block: ElementObject): string | null => {
    const { type, x1, y1, x2, y2 } = block; 
    // if(type === 'square') {
    //     const topLeft = nearPoint(x, y, x1, y1, 'top-left');
    //     const topRight = nearPoint(x, y, x2, y1, 'top-right');
    //     const bottomLeft = nearPoint(x, y, x1, y2, 'bottom-left');
    //     const bottomRight = nearPoint(x, y, x2, y2, 'bottom-right');
    //     const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? 'inside' : null;
    //     return topLeft || topRight || bottomLeft || bottomRight || inside;
    // } else {
        return  x >= x1 && x <= x2 && y >= y1 && y <= y2 ? 'inside' : null;
    // }
}

const getElementAtPosition = (x: number, y: number, blocks: Array<ElementObject>): ElementObject | undefined => {
    const mappedResults = blocks.map((block: ElementObject) => {
        const position = positionWithinElement(x, y, block);
        return {...block, position}});
    return mappedResults.find((block: ElementObject) => block.position !== null);
}

const createBlock = (id: number, x1: number, y1: number, x2: number, y2: number, selectedTool: ElementObject['type']): ElementObject => {
    if(selectedTool === 'text') {
        return { id, type: selectedTool, x1, y1, x2, y2, text: "" }
    }
    return {id, x1, y1, x2, y2, type: selectedTool};
}

const updateBlock = (id: number, x1: number, y1: number, x2: number, y2: number, type: ElementObject['type'], blocks: Array<ElementObject>, setBlocks: (blocks: Array<ElementObject>) => void, options?: {[key: string]: any}) => {
    const updatedBlocks = [...blocks];
    switch (type) {
        case 'text':
            const canvas: any = document.getElementById('certificates-canvas');
            if (canvas?.getContext && options) {
                const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
                const textWidth = ctx.measureText(options.text).width;
                const textHeight = 24;
                updatedBlocks[id] = {
                    ...createBlock(id, x1, y1, x1 + textWidth, y1 + textHeight, type),
                    text: options.text,
                };
            }
            break;
        default:
            throw new Error(`Type not recognised: ${type}`);
    }
    setBlocks(updatedBlocks);
}

const adjustElementCoordinates = (block: ElementObject) => {
    const { x1, y1, x2, y2} = block;
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

const createTextElement = (block: ElementObject, ctx: CanvasRenderingContext2D) => {
    ctx.textBaseline = 'top';
    ctx.font = "24px sans-serif";
    ctx.fillText(block.text || "", block.x1, block.y1);
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

const renderTextBlock = (context: CanvasRenderingContext2D, textBlock: TextBlock) => {
    const {
        boundingBox,
        text,
        color,
        fontFamily,
        fontSize: idealFontSize,
        align,
        verticalAlign,
    } = textBlock;

    const testSize = (test: number): boolean => {
        context.font = `${test}px ${textBlock.fontFamily}`;
        const measurements = context.measureText(textBlock.text);
        const width = measurements.width;
        const height = measurements.actualBoundingBoxAscent;
        return width <= textBlock.boundingBox.width && height <= textBlock.boundingBox.height;
    };

    const getMaximumFontSizeThatFits = (attemptFontSize: number): number => {
        // TODO a better default?
        if (attemptFontSize <= 1) {
            return attemptFontSize;
        }
        if (testSize(attemptFontSize)) {
            return attemptFontSize;
        }
        return getMaximumFontSizeThatFits(attemptFontSize - 1);
    };

    const getAlignmentXOffset = (fontSize: number): number => {
        context.font = `${fontSize}px ${fontFamily}`;
        const textWidth = context.measureText(text).width;
        switch (align) {
            case 'left':
                return boundingBox.x;
            case 'center':
                return boundingBox.x + boundingBox.width / 2 - textWidth / 2;
            case 'right':
                return boundingBox.x + boundingBox.width - textWidth;
        }
    };

    const getAlignmentYOffsetAndBaseline = (): { y: number; baseline: CanvasTextBaseline } => {
        switch (verticalAlign) {
            case 'hanging': {
                return { y: boundingBox.y + boundingBox.height, baseline: 'alphabetic' };
            }
            case 'top': {
                return { y: boundingBox.y, baseline: 'hanging' };
            }
            case 'center': {
                context.textBaseline = 'alphabetic';
                const textHeight = context.measureText(text).actualBoundingBoxAscent;
                return {
                    y: boundingBox.y + boundingBox.height / 2 + textHeight / 2,
                    baseline: 'alphabetic',
                };
            }
            case 'bottom': {
                return { y: boundingBox.y + boundingBox.height, baseline: 'bottom' };
            }
        }
    };

    const fontSize = getMaximumFontSizeThatFits(idealFontSize);
    context.font = `${fontSize}px ${fontFamily}`;
    const x = getAlignmentXOffset(fontSize);
    const { y, baseline } = getAlignmentYOffsetAndBaseline();
    context.textBaseline = baseline;
    context.fillStyle = color;
    context.fillText(text, x, y);
};


const renderBlock = (context: CanvasRenderingContext2D, block: ElementObject) => {
    switch (block.type) {
        case 'text': {
            return createTextElement(block, context);
        }
        default:
            throw new Error(`Type not recognised: ${block.type}`);
    }
};

export const DrawingCanvas: FunctionComponent = () => {

    const [ blocks, setBlocks ] = useState<Array<ElementObject>>([]);
    const [ action, setAction ] = useState<ActionStatus>('none');
    const [ selectedTool, setSelectedTool ] = useState< 'selection' | 'text'>('text');
    const [ selectedBlock, setSelectedElement ] = useState<ElementObject | null>(null);
    const textAreaRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            const image = new Image();
            image.src = '/certificate-background.png';
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            if(blocks.length) {
                ctx.save();
                blocks.forEach((block: ElementObject) => {
                    if(action === 'writing' && selectedBlock?.id === block.id) return;
                    renderBlock(ctx, block);
                });
                ctx.restore();
            }
        }
    }, [action, blocks, selectedBlock?.id, selectedTool]);

    useEffect(() => {
        const textArea = textAreaRef.current;
        if (action === "writing" && textArea) {
            setTimeout(() => {
              textArea.focus();
              textArea.value = selectedBlock?.text || "";
            }, 0);
          }
    }, [action, textAreaRef, selectedBlock, selectedBlock?.id]);

    const resetCanvas = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setBlocks([]);
            setSelectedElement(null);
        }
    }, []);

    const handleMouseDown = useCallback((event: MouseEvent) => {
        console.log(`event: `, event);
        if(action === 'writing') return;
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedTool === 'selection') {
            const block: ElementObject | undefined = getElementAtPosition(offsetX, offsetY, blocks);
            if(block){
                const mouseOffsetX: number = offsetX - block.x1;
                const mouseOffsetY: number = offsetY - block.y1;
                setSelectedElement({...block, mouseOffsetX, mouseOffsetY});
                if(block.position && block.position === 'inside'){
                    setAction('moving');
                }
                else {
                    setAction('resizing');
                }
            }
        } else {
            const block: ElementObject = createBlock(blocks.length, offsetX, offsetY, offsetX, offsetY, selectedTool);
            setBlocks([...blocks, block]);
            setSelectedElement(block);
            setAction((block.type === 'text') ? 'writing' : 'drawing');
        }
    }, [action, blocks, selectedTool]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        const { offsetX, offsetY } = event.nativeEvent;

        if(selectedTool === 'selection' && event.target instanceof HTMLElement) {
            const block = getElementAtPosition(offsetX, offsetY, blocks);
            event.target.style.cursor = block ? cursorForPosition(block.position) : 'default';
        }

        if(action === 'drawing' && selectedTool !== 'selection') {
            const index: number = blocks.length -1;
            const {x1, y1} = blocks[index];
            updateBlock(index, x1, y1, offsetX, offsetY, selectedTool, blocks, setBlocks);
        } else if (action === 'moving' && selectedBlock) {
            const { id, x1, y1, x2, y2, type, mouseOffsetX, mouseOffsetY } = selectedBlock;
            const width: number = x2 - x1;
            const height: number = y2 - y1;
            const updatedOffsetX: number = (mouseOffsetX) ? offsetX - mouseOffsetX : offsetX;
            const updatedOffsetY: number = (mouseOffsetY) ? offsetY - mouseOffsetY : offsetY;
            const options = (type === 'text') ? { text: selectedBlock.text} : {};
            updateBlock(id, updatedOffsetX, updatedOffsetY, updatedOffsetX + width, updatedOffsetY + height, type, blocks, setBlocks, options);
        } else if(action === 'resizing' && selectedBlock) {
            const { id, type, position, ...coordinates } = selectedBlock;
            let options = (type === 'text') ? { text: selectedBlock.text} : {};
            const {x1, x2, y1, y2} = resizedCoordinates(offsetX, offsetY, position || null, coordinates);
            updateBlock(id, x1, y1, x2, y2, type, blocks, setBlocks, options);
        }
    }, [action, blocks, selectedBlock, selectedTool]);

    const handleMouseUp = useCallback((event: any) => {
        console.log(`event: `, event);
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedBlock && selectedBlock.mouseOffsetX && selectedBlock.mouseOffsetY) {
            if(selectedBlock.type === 'text' && offsetX - selectedBlock.mouseOffsetX === selectedBlock.x1 && offsetY - selectedBlock.mouseOffsetY === selectedBlock.y1) {
                setAction('writing');
                return;
            }
            const index: number = selectedBlock.id;
            const {id, type} = blocks[index];
            if( action === 'drawing' || action === 'resizing') {
               const { x1, y1, x2, y2 } = adjustElementCoordinates(blocks[index]);
               updateBlock(id, x1, y1, x2, y2, type, blocks, setBlocks);
            }
        }
        if(action !== 'writing') {
            setSelectedElement(null);
            setAction('none');
        }
    }, [action, blocks, selectedBlock]);

    const handleElementSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedTool(event.target.value as ElementObject['type']);
    }, []);

    const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
        if(selectedBlock) {
            const { id, x1, y1, x2, y2, type } = selectedBlock;
            setSelectedElement(null);
            updateBlock(id, x1, y1, x2, y2, type, blocks, setBlocks, { text: event.target.value });
        }
        setAction('none');
    }, [blocks, selectedBlock]);

    return (
        <section className={styles.drawingCanvasSection}>
            {/* <div>
                <img
                    id="source"
                    src="./certificate-background.jpeg"
                    width="300"
                    height="227"
                    alt="Rhino" 
                />
            </div> */}
            {(action === 'writing' && selectedBlock) ? 
            <div 
                style={{     
                    width: '100%',
                    position: 'absolute', 
                    top: selectedBlock.y1 - 25, 
                    left: selectedBlock.x1, 
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
                    <option value='text'>Text</option>
                    <option value='selection'>Selection</option>
                </select>
                </label>
                <button onClick={resetCanvas}>Reset</button>
            </div>
        </section>
    );
};
