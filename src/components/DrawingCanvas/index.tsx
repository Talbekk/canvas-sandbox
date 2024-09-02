import React, { FunctionComponent, useCallback } from 'react';
import styles from './styles.module.css';

export const DrawingCanvas: FunctionComponent = () => {

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

    const resetCanvas = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            // @ts-ignore
            ctx.reset();
        }
    }, []);

    return (
        <section className={styles.drawingCanvasSection}>
            <canvas id="certificates-canvas" className={styles.drawingCanvasContainer}>
                Custom certificate
            </canvas>
            <div className={styles.actionButtonRow}>
                <button onClick={square}>Square</button>
                <button onClick={triangle}>Triangle</button>
                <button onClick={smile}>Smile</button>
                <button onClick={path2D}>Path2D</button>
                <button onClick={resetCanvas}>Reset</button>
            </div>
        </section>
    );
};
