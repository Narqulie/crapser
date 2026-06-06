/**
 * @fileoverview NPC shopkeeper definitions for the rogue-lite shop system.
 * Each NPC serves as a potential shopkeeper offering upgrades between hands
 * in the alleyway craps game.
 * @module npcs
 */

/** @type {Array<{id: string, name: string, color: string, initials: string, greeting: string}>} */
export const NPC_DEFS = [
  {
    id: 'larry',
    name: 'Lucky Larry',
    color: '#4CAF50',
    initials: 'L',
    greeting: 'Feeling lucky? I got what you need.',
  },
  {
    id: 'sal',
    name: 'Sal the Stat',
    color: '#2196F3',
    initials: 'S',
    greeting: 'The numbers say you should browse.',
  },
  {
    id: 'mike',
    name: 'Big Mike',
    color: '#FF5722',
    initials: 'M',
    greeting: "Let's GO! Check out this inventory!",
  },
  {
    id: 'ruth',
    name: 'Old Ruth',
    color: '#9C27B0',
    initials: 'R',
    greeting: 'Take your time, dear. Good things here.',
  },
  {
    id: 'nick',
    name: 'Nervous Nick',
    color: '#FF9800',
    initials: 'N',
    greeting: 'Oh! Uh, want to... maybe look at my stuff?',
  },
  {
    id: 'diane',
    name: 'Deadeye Diane',
    color: '#00BCD4',
    initials: 'D',
    greeting: 'Nice gear. You want some?',
  },
];
