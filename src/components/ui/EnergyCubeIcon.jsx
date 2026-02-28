import React from 'react';
import { cn } from '@/lib/utils';

/**
 * EnergyCubeIcon - A premium, theme-aware animated SVG logo.
 * Replaces the default sparkle icon for AI features.
 * 
 * Design: Isometric 3D Cube with an energy bolt.
 * Animation: Floating body + Pulsing bolt.
 */
const EnergyCubeIcon = ({ className, size = 28, ...props }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("energy-cube-svg", className)}
            {...props}
        >
            <defs>
                <filter id="cube-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <style>
                    {`
            @keyframes minimal-float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-2px); }
            }
            @keyframes bolt-flash {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.05); }
            }
            .energy-cube-svg {
              animation: minimal-float 4s ease-in-out infinite;
              overflow: visible !important;
            }
            .minimal-bolt {
              animation: bolt-flash 2.5s ease-in-out infinite;
              transform-origin: center;
            }
            :root {
              --cube-line: #111111;
              --cube-fill: #FFFFFF;
              --bolt-color: #3B82F6;
            }
            .dark {
              --cube-line: #FFFFFF;
              --cube-fill: rgba(255,255,255,0.05);
              --bolt-color: #60A5FA;
            }
          `}
                </style>
            </defs>

            {/* Optimized Minimalist Isometric Cube */}
            <g strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                {/* Simplified Cube Path - One continuous stroke for the frame if possible, or clean faces */}
                <path
                    d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
                    stroke="var(--cube-line)"
                    fill="var(--cube-fill)"
                    fillOpacity="0.4"
                />
                <path
                    d="M12 22V12M12 12L21 7M12 12L3 7"
                    stroke="var(--cube-line)"
                />
            </g>

            {/* Minimal Bolt - Centered and Sharp */}
            <path
                className="minimal-bolt"
                d="M13 6L10 11H13L11 18L14 13H11L13 6Z"
                fill="var(--bolt-color)"
                stroke="var(--bolt-color)"
                strokeWidth="1"
                strokeLinejoin="round"
                filter="url(#cube-glow)"
            />
        </svg>
    );
};

export default EnergyCubeIcon;
