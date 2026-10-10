import React from 'react';
import { Flame, AlertTriangle, ShieldCheck, Waves } from 'lucide-react';

interface AnimatedCylinderProps {
  weightKg: number;
  totalMassKg: number;
  tareMassKg: number;
  capacityKg: number;
  isLeak: boolean;
  isFault: boolean;
  isOnline: boolean;
}

export const AnimatedCylinder: React.FC<AnimatedCylinderProps> = ({
  weightKg,
  totalMassKg,
  tareMassKg,
  capacityKg,
  isLeak,
  isFault,
  isOnline,
}) => {
  // Clamped percentage calculation
  const percentage = Math.max(0, Math.min(100, Math.round((weightKg / capacityKg) * 100)));

  // State derivation
  let cylinderState: 'normal' | 'caution' | 'critical' = 'normal';
  if (isLeak || percentage < 20) {
    cylinderState = 'critical';
  } else if (percentage < 35 || isFault || !isOnline) {
    cylinderState = 'caution';
  }

  // Fluid height in SVG units (viewport height 200px from y=40 to y=240)
  const maxHeight = 190;
  const liquidHeight = Math.max(8, (percentage / 100) * maxHeight);
  const liquidTopY = 240 - liquidHeight;

  return (
    <div className={`glass-cylinder-container ${cylinderState}`}>
      <div className="cylinder-header-bar">
        <div className="cylinder-title-wrap">
          <div className="cylinder-badge-dot" />
          <span className="cylinder-title">Smart LPG Mass Visualizer</span>
        </div>
        <div className={`cylinder-status-tag ${cylinderState}`}>
          {cylinderState === 'critical' ? (
            <>
              <AlertTriangle size={12} />
              <span>{isLeak ? 'CRITICAL LEAK' : 'CRITICAL RESERVE'}</span>
            </>
          ) : cylinderState === 'caution' ? (
            <>
              <Flame size={12} />
              <span>{percentage < 35 ? 'LOW CYLINDER' : 'ATTENTION'}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={12} />
              <span>NOMINAL VOLUME</span>
            </>
          )}
        </div>
      </div>

      <div className="cylinder-visual-layout">
        {/* Animated SVG Cylinder */}
        <div className="cylinder-svg-wrapper">
          <svg
            viewBox="0 0 180 290"
            className="cylinder-svg-graphic"
            aria-label={`LPG Cylinder graphic at ${percentage}% capacity`}
          >
            <defs>
              {/* Metallic Body Outer Gradient */}
              <linearGradient id="metalBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="25%" stopColor="#334155" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="75%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Glass Window Inner Gradient */}
              <linearGradient id="glassCutoutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(15, 23, 42, 0.85)" />
                <stop offset="50%" stopColor="rgba(30, 41, 59, 0.65)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.85)" />
              </linearGradient>

              {/* Liquid Fuel Normal Gradient */}
              <linearGradient id="liquidNormalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#0d9488" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#042f2e" stopOpacity="0.98" />
              </linearGradient>

              {/* Liquid Fuel Caution Gradient */}
              <linearGradient id="liquidCautionGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#451a03" stopOpacity="0.98" />
              </linearGradient>

              {/* Liquid Fuel Critical Gradient */}
              <linearGradient id="liquidCriticalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#dc2626" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#450a0a" stopOpacity="0.98" />
              </linearGradient>

              {/* Liquid Wave Pattern Mask */}
              <clipPath id="cylinderLiquidClip">
                <rect x="42" y="55" width="96" height="185" rx="6" />
              </clipPath>
            </defs>

            {/* CYLINDER VALVE & TOP GUARD COLLAR */}
            {/* Brass Valve Stem */}
            <rect x="85" y="10" width="10" height="15" rx="2" fill="#d97706" />
            <ellipse cx="90" cy="10" rx="8" ry="4" fill="#f59e0b" />
            
            {/* Top Collar Outer Shield */}
            <path
              d="M 50,45 Q 90,25 130,45 L 134,60 Q 90,40 46,60 Z"
              fill="url(#metalBodyGrad)"
              stroke="#475569"
              strokeWidth="1.5"
            />
            {/* Collar Hand Cutouts */}
            <ellipse cx="68" cy="48" rx="8" ry="4" fill="#090d16" />
            <ellipse cx="112" cy="48" rx="8" ry="4" fill="#090d16" />

            {/* CYLINDER MAIN BODY SHELL */}
            {/* Top Dome */}
            <path
              d="M 38,75 Q 90,45 142,75 L 142,240 Q 90,265 38,240 Z"
              fill="url(#metalBodyGrad)"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="2"
            />

            {/* Middle Weld Seam */}
            <line x1="38" y1="160" x2="142" y2="160" stroke="#1e293b" strokeWidth="2.5" />
            <line x1="38" y1="161" x2="142" y2="161" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />

            {/* Bottom Ring Stand Footing */}
            <ellipse cx="90" cy="265" rx="46" ry="12" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <ellipse cx="90" cy="263" rx="42" ry="9" fill="#0f172a" />

            {/* GLASS CUTOUT VIEWPORT (Shows Liquid Inside) */}
            <rect
              x="42"
              y="55"
              width="96"
              height="185"
              rx="8"
              fill="url(#glassCutoutGrad)"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1.5"
            />

            {/* LIQUID LPG LAYER WITH WAVE EFFECT */}
            <g clipPath="url(#cylinderLiquidClip)">
              {/* Vapor Space with Mist */}
              <rect x="42" y="55" width="96" height={185} fill="rgba(15, 23, 42, 0.4)" />
              
              {/* Liquid Fill Rectangle */}
              <rect
                x="42"
                y={liquidTopY}
                width="96"
                height={liquidHeight + 10}
                fill={
                  cylinderState === 'critical'
                    ? 'url(#liquidCriticalGrad)'
                    : cylinderState === 'caution'
                    ? 'url(#liquidCautionGrad)'
                    : 'url(#liquidNormalGrad)'
                }
                className="liquid-fluid-rect"
              />

              {/* Animated Wave 1 */}
              <path
                d={`M 40,${liquidTopY} Q 65,${liquidTopY - 6} 90,${liquidTopY} T 140,${liquidTopY} L 140,${liquidTopY + 12} L 40,${liquidTopY + 12} Z`}
                fill={cylinderState === 'critical' ? '#f87171' : cylinderState === 'caution' ? '#fbbf24' : '#5eead4'}
                opacity="0.85"
                className="cylinder-wave-path wave-1"
              />

              {/* Animated Wave 2 */}
              <path
                d={`M 40,${liquidTopY + 2} Q 60,${liquidTopY + 7} 90,${liquidTopY + 1} T 140,${liquidTopY + 3} L 140,${liquidTopY + 14} L 40,${liquidTopY + 14} Z`}
                fill={cylinderState === 'critical' ? '#ef4444' : cylinderState === 'caution' ? '#d97706' : '#14b8a6'}
                opacity="0.6"
                className="cylinder-wave-path wave-2"
              />

              {/* Rising LPG Micro-Bubbles */}
              <circle cx="65" cy={liquidTopY + liquidHeight * 0.7} r="2.5" className="gas-bubble b1" />
              <circle cx="95" cy={liquidTopY + liquidHeight * 0.5} r="3" className="gas-bubble b2" />
              <circle cx="115" cy={liquidTopY + liquidHeight * 0.8} r="2" className="gas-bubble b3" />
              <circle cx="78" cy={liquidTopY + liquidHeight * 0.3} r="2.5" className="gas-bubble b4" />
            </g>

            {/* Glass Viewport Highlights & Reflections */}
            <path
              d="M 45,58 L 54,58 L 54,235 L 45,235 Z"
              fill="linear-gradient(90deg, rgba(255,255,255,0.4), transparent)"
              opacity="0.25"
            />
            <path
              d="M 130,58 L 135,58 L 135,235 L 130,235 Z"
              fill="rgba(255,255,255,0.15)"
            />

            {/* Calibration Height Ruler Scale Markers on Side */}
            <line x1="134" y1="65" x2="140" y2="65" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <text x="143" y="68" fontSize="8" fill="#94a3b8" fontFamily="monospace">100%</text>

            <line x1="134" y1="110" x2="138" y2="110" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <text x="143" y="113" fontSize="8" fill="#64748b" fontFamily="monospace">75%</text>

            <line x1="134" y1="150" x2="140" y2="150" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <text x="143" y="153" fontSize="8" fill="#94a3b8" fontFamily="monospace">50%</text>

            <line x1="134" y1="195" x2="138" y2="195" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <text x="143" y="198" fontSize="8" fill="#64748b" fontFamily="monospace">25%</text>

            <line x1="134" y1="235" x2="140" y2="235" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <text x="143" y="238" fontSize="8" fill="#f87171" fontFamily="monospace">0%</text>
          </svg>
        </div>

        {/* Cylinder Diagnostic Data Callout */}
        <div className="cylinder-info-column">
          {/* Main Percentage Display */}
          <div className="cylinder-percentage-display">
            <div className="cylinder-pct-number">
              {percentage}<span className="cylinder-pct-symbol">%</span>
            </div>
            <div className="cylinder-pct-subtitle">
              Calculated Usable Capacity
            </div>
          </div>

          {/* Mass Telemetry Grid */}
          <div className="cylinder-metrics-stack">
            <div className="cylinder-stat-chip">
              <span className="chip-label">Liquid Gas Remaining</span>
              <span className="chip-value text-glow-cyan">{weightKg.toFixed(2)} kg</span>
            </div>

            <div className="cylinder-stat-chip">
              <span className="chip-label">Empty Cylinder Tare</span>
              <span className="chip-value">{tareMassKg.toFixed(2)} kg</span>
            </div>

            <div className="cylinder-stat-chip">
              <span className="chip-label">Gross Platform Mass</span>
              <span className="chip-value">{totalMassKg.toFixed(2)} kg</span>
            </div>

            <div className="cylinder-stat-chip">
              <span className="chip-label">Rated Full Capacity</span>
              <span className="chip-value">{capacityKg.toFixed(1)} kg</span>
            </div>
          </div>

          {/* Thermodynamic / Safety State Indicator */}
          <div className="cylinder-phase-pill">
            <Waves size={13} className="spin-slow" />
            <span>
              {percentage > 25
                ? 'Standard 2-Phase Liquid/Vapor Equilibrium'
                : percentage > 0
                ? 'Low Vapor Pressure Zone: Schedule Cylinder Swap'
                : 'Cylinder Exhausted: Platform Reached Tare Mass'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AnimatedCylinder;
