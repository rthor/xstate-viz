import { useActor, useSelector } from '@xstate/react';
import React, { useEffect, useRef } from 'react';
import type { Guard } from 'xstate';
import { DirectedGraphEdge } from './directedGraph';
import { EventTypeViz, toDelayString } from './EventTypeViz';
import { deleteRect, setRect } from './getRect';
import { Point } from './pathUtils';
import './TransitionViz.scss';
import { useSimulation } from './SimulationContext';
import { useMemo } from 'react';

const getGuardType = (guard: Guard<any, any>) => {
  return guard.name; // v4
};

export type DelayedTransitionMetadata =
  | { status: 'NOT_DELAYED' }
  | { status: 'DELAYED_INVALID' }
  | { status: 'DELAYED_VALID'; delay: number; delayMs: string };
const getDelayFromEventType = (
  eventType: string,
): DelayedTransitionMetadata => {
  const isDelayedEvent = eventType.startsWith('xstate.after');

  if (!isDelayedEvent) return { status: 'NOT_DELAYED' };

  const DELAYED_EVENT_REGEXT = /^xstate\.after\((.*)\)#.*$/;
  // Validate the delay duration
  const match = eventType.match(DELAYED_EVENT_REGEXT);

  if (!match) return { status: 'DELAYED_INVALID' };

  const [, delay] = match;

  return {
    status: 'DELAYED_VALID',
    delay: +delay,
    delayMs: toDelayString(delay),
  };
};

export const TransitionViz: React.FC<{
  edge: DirectedGraphEdge;
  position?: Point;
  index: number;
}> = ({ edge, index, position }) => {
  const definition = edge.transition;
  const service = useSimulation();
  const state = useSelector(service, (s) =>
    s.context.services[s.context.service!]?.getSnapshot(),
  );
  const delay = useMemo(() => getDelayFromEventType(definition.eventType), [
    definition.eventType,
  ]);

  const ref = useRef<any>(null);
  useEffect(() => {
    if (ref.current) {
      setRect(edge.id, ref.current);
    }
    return () => {
      deleteRect(edge.id);
    };
  }, [edge.id]);

  if (!state) {
    return null;
  }

  return (
    <div
      data-viz="transition"
      data-viz-potential={
        (state.nextEvents.includes(edge.transition.eventType) &&
          !!state.configuration.find((sn) => sn === edge.source)) ||
        undefined
      }
      style={{
        position: 'absolute',
        ...(position && { left: `${position.x}px`, top: `${position.y}px` }),
      }}
      ref={ref}
    >
      <button
        data-viz="transition-label"
        disabled={
          delay.status === 'DELAYED_INVALID' ||
          !state.nextEvents.includes(definition.eventType)
        }
        style={
          {
            '--delay': delay.status === 'DELAYED_VALID' && delay.delay,
          } as React.CSSProperties
        }
        data-is-delayed={delay.status !== 'NOT_DELAYED'}
        onMouseEnter={() => {
          service.send({
            type: 'EVENT.PREVIEW',
            eventType: definition.eventType,
          });
        }}
        onMouseLeave={() => {
          service.send({
            type: 'PREVIEW.CLEAR',
          });
        }}
        onClick={() => {
          // TODO: only if no parameters/schema
          service.send({
            type: 'SERVICE.SEND',
            event: {
              type: definition.eventType,
            },
          });
        }}
      >
        <span
          data-viz="transition-event"
          data-is-delayed={delay.status !== 'NOT_DELAYED'}
        >
          <EventTypeViz eventType={definition.eventType} delay={delay} />
        </span>
        {definition.cond && (
          <span data-viz="transition-guard">
            {getGuardType(definition.cond)}
          </span>
        )}
      </button>
      {definition.actions.length > 0 && (
        <div data-viz="transition-actions">
          {definition.actions.map((action) => {
            return (
              <div data-viz="action" data-viz-action="do" key={action.type}>
                <span data-viz="action-text">{action.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
