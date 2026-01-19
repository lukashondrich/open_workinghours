import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { FeatureCollection } from 'geojson';

// Import data - these will be bundled at build time
import germanyStates from './germany-states.json';
import hospitalsData from './hospitals.json';

interface Hospital {
  name: string;
  lat: number;
  lon: number;
  city: string;
  state: string;
}

interface Props {
  locale?: 'en' | 'de';
}

const labels = {
  en: {
    hospital: 'Hospital',
    noData: 'No data yet',
    building: 'Building (1–10)',
    available: 'Available (11+)',
  },
  de: {
    hospital: 'Krankenhäuser',
    noData: 'Keine Daten',
    building: 'Im Aufbau (1–10)',
    available: 'Freigeschaltet (11+)',
  },
};

interface CoverageData {
  [stateCode: string]: number; // 0 = no data, 1 = building, 2 = available
}

// Map German state names to codes used in GeoJSON
const stateNameToCode: { [name: string]: string } = {
  'Baden-Württemberg': 'DE-BW',
  'Bayern': 'DE-BY',
  'Berlin': 'DE-BE',
  'Brandenburg': 'DE-BB',
  'Bremen': 'DE-HB',
  'Hamburg': 'DE-HH',
  'Hessen': 'DE-HE',
  'Mecklenburg-Vorpommern': 'DE-MV',
  'Niedersachsen': 'DE-NI',
  'Nordrhein-Westfalen': 'DE-NW',
  'Rheinland-Pfalz': 'DE-RP',
  'Saarland': 'DE-SL',
  'Sachsen': 'DE-SN',
  'Sachsen-Anhalt': 'DE-ST',
  'Schleswig-Holstein': 'DE-SH',
  'Thüringen': 'DE-TH',
};

// Colors from spec
const colors = {
  noData: '#D6D3D1',     // Stone-300
  building: '#FBBF24',   // Amber-400
  available: '#0D9488',  // Teal-600
  hospitalDot: '#0F766E', // Teal-700
  hospitalHover: '#14B8A6', // Teal-500
  border: '#A8A29E',     // Stone-400
};

function getStateColor(status: number): string {
  switch (status) {
    case 2: return colors.available;
    case 1: return colors.building;
    default: return colors.noData;
  }
}

export default function InteractiveMap({ locale = 'en' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null);
  const t = labels[locale];

  // Mock coverage data for now (all states = no data)
  const [coverage] = useState<CoverageData>(() => {
    const data: CoverageData = {};
    Object.values(stateNameToCode).forEach(code => {
      data[code] = 0; // No data
    });
    // Add some mock data for visual testing
    data['DE-BY'] = 1; // Bavaria = building
    data['DE-NW'] = 2; // NRW = available
    return data;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 500;

    // Clear previous SVG
    d3.select(container).selectAll('svg').remove();

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#FAFAF9'); // Stone-50

    svgRef.current = svg.node();

    // Create a group for zoom/pan
    const g = svg.append('g');

    // Set up projection for Germany
    const projection = d3.geoMercator()
      .center([10.5, 51.2]) // Center of Germany
      .scale(width * 4)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Draw states
    const states = g.selectAll('path')
      .data((germanyStates as FeatureCollection).features)
      .join('path')
      .attr('d', path as any)
      .attr('fill', d => {
        const stateId = (d.properties as any)?.id || '';
        return getStateColor(coverage[stateId] || 0);
      })
      .attr('stroke', colors.border)
      .attr('stroke-width', 1);

    // Draw hospital dots
    const hospitals = hospitalsData as Hospital[];
    const baseRadius = 3;
    const hoverRadius = 5;

    const circles = g.selectAll('circle')
      .data(hospitals)
      .join('circle')
      .attr('cx', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[0] : 0;
      })
      .attr('cy', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[1] : 0;
      })
      .attr('r', baseRadius)
      .attr('fill', colors.hospitalDot)
      .attr('opacity', 0.7)
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const currentScale = d3.zoomTransform(svg.node()!).k;
        d3.select(event.target)
          .attr('fill', colors.hospitalHover)
          .attr('r', hoverRadius / currentScale);
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          name: d.name
        });
      })
      .on('mouseleave', (event) => {
        const currentScale = d3.zoomTransform(svg.node()!).k;
        d3.select(event.target)
          .attr('fill', colors.hospitalDot)
          .attr('r', baseRadius / currentScale);
        setTooltip(null);
      });

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Scale dots inversely with zoom to keep them visually consistent
        circles.attr('r', baseRadius / event.transform.k);
      });

    svg.call(zoom);

    // Store zoom for controls
    (container as any).__zoom = zoom;
    (container as any).__svg = svg;

  }, [coverage]);

  const handleZoomIn = () => {
    const container = containerRef.current;
    if (!container) return;
    const zoom = (container as any).__zoom;
    const svg = (container as any).__svg;
    if (zoom && svg) {
      svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    const container = containerRef.current;
    if (!container) return;
    const zoom = (container as any).__zoom;
    const svg = (container as any).__svg;
    if (zoom && svg) {
      svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    }
  };

  const handleReset = () => {
    const container = containerRef.current;
    if (!container) return;
    const zoom = (container as any).__zoom;
    const svg = (container as any).__svg;
    if (zoom && svg) {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    }
  };

  return (
    <div className="relative">
      {/* Zoom Controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-white border border-stone-300 rounded shadow-sm hover:bg-stone-50 flex items-center justify-center text-stone-700"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white border border-stone-300 rounded shadow-sm hover:bg-stone-50 flex items-center justify-center text-stone-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={handleReset}
          className="w-8 h-8 bg-white border border-stone-300 rounded shadow-sm hover:bg-stone-50 flex items-center justify-center text-stone-700 text-xs"
          aria-label="Reset view"
        >
          ↺
        </button>
      </div>

      {/* Map Container */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-stone-800 text-white text-sm px-2 py-1 rounded shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.name}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm text-stone-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.hospitalDot }} />
          <span>{t.hospital}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: colors.noData }} />
          <span>{t.noData}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: colors.building }} />
          <span>{t.building}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: colors.available }} />
          <span>{t.available}</span>
        </div>
      </div>
    </div>
  );
}
