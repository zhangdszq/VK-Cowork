/**
 * Memory API routes
 * Provides CRUD endpoints for the dual-layer memory system.
 */
import { Hono } from 'hono';
import {
  readLongTermMemory,
  writeLongTermMemory,
  readDailyMemory,
  appendDailyMemory,
  writeDailyMemory,
  listDailyMemories,
  buildMemoryContext,
  getMemoryDir,
  getMemorySummary,
} from '../../libs/memory-store.js';

export const memoryRoutes = new Hono();

// GET /memory — full assembled memory context
memoryRoutes.get('/', (c) => {
  try {
    const context = buildMemoryContext();
    const summary = getMemorySummary();
    return c.json({ context, summary, memoryDir: getMemoryDir() });
  } catch (error) {
    return c.json({ error: 'Failed to read memory', message: String(error) }, 500);
  }
});

// GET /memory/long-term — raw MEMORY.md content
memoryRoutes.get('/long-term', (c) => {
  try {
    const content = readLongTermMemory();
    return c.json({ content });
  } catch (error) {
    return c.json({ error: 'Failed to read long-term memory', message: String(error) }, 500);
  }
});

// PUT /memory/long-term — overwrite MEMORY.md
memoryRoutes.put('/long-term', async (c) => {
  try {
    const { content } = await c.req.json<{ content: string }>();
    writeLongTermMemory(content);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to write long-term memory', message: String(error) }, 500);
  }
});

// GET /memory/daily/:date? — get daily memory (defaults to today)
memoryRoutes.get('/daily/:date?', (c) => {
  try {
    const date = c.req.param('date') ?? new Date().toISOString().slice(0, 10);
    const content = readDailyMemory(date);
    return c.json({ date, content });
  } catch (error) {
    return c.json({ error: 'Failed to read daily memory', message: String(error) }, 500);
  }
});

// POST /memory/daily — append to today's daily memory
memoryRoutes.post('/daily', async (c) => {
  try {
    const { content, date } = await c.req.json<{ content: string; date?: string }>();
    appendDailyMemory(content, date);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to append daily memory', message: String(error) }, 500);
  }
});

// PUT /memory/daily/:date — overwrite a specific daily memory
memoryRoutes.put('/daily/:date', async (c) => {
  try {
    const date = c.req.param('date');
    const { content } = await c.req.json<{ content: string }>();
    writeDailyMemory(content, date);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to write daily memory', message: String(error) }, 500);
  }
});

// GET /memory/list — list all memory files
memoryRoutes.get('/list', (c) => {
  try {
    const dailies = listDailyMemories();
    const longTerm = readLongTermMemory();
    return c.json({
      memoryDir: getMemoryDir(),
      longTermExists: longTerm.length > 0,
      longTermSize: longTerm.length,
      dailies,
    });
  } catch (error) {
    return c.json({ error: 'Failed to list memories', message: String(error) }, 500);
  }
});
