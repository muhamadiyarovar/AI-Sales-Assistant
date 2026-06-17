import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { getKb } from "../lib/kb-store";

const router: IRouter = Router();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

// ── System prompt ─────────────────────────────────────────────────
const NEGOTIATION_SYSTEM_PROMPT = `Ты — ИИ-тренажёр переговоров для сотрудников отдела партнёрских продаж Школы 21 (Сбер).

ТВОЯ РОЛЬ: Сыграй роль партнёра типа «{{PARTNER}}», который рассматривает возможность приобрести образовательные программы Школы 21 для своих сотрудников / обучающихся.

ПРОГРАММЫ ДЛЯ ОБСУЖДЕНИЯ: {{PRODUCTS}}

БАЗА ЗНАНИЙ ПО ПРОГРАММАМ:
{{KNOWLEDGE_BASE}}

ПРАВИЛА ДИАЛОГА:
1. Начни с короткого представления своей организации и первого вопроса или возражения от лица партнёра.
2. Веди диалог реалистично: задавай вопросы и возражения по одному, не выдавай всё сразу.
3. Всего сделай 5–7 реплик со стороны партнёра. Используй типовые возражения из базы знаний, адаптируй их под тип партнёра.
4. Реагируй на качество ответов: слабый ответ — усиль скептицизм; сильный, конкретный ответ — смягчись и прими.
5. Когда собеседник ответил на 5–7 твоих реплик — выйди из роли и дай развёрнутую обратную связь:
   ✅ Что сделано хорошо (конкретно)
   ⚠️ Где ответы можно усилить и как именно
   🎯 Итоговая оценка: X/10 с кратким обоснованием

ПРОФИЛЬ ПАРТНЁРА по типу:
- Бизнес: менеджер по персоналу или директор по обучению из коммерческой компании. Интересует ROI, скорость, практическая применимость навыков, стоимость.
- Госсектор: руководитель департамента или замминистра. Интересует соответствие нормативам, бюджетная эффективность, статус партнёра, документы по итогам.
- Образовательная организация: проректор, декан или заведующий кафедрой. Интересует академическая ценность, интеграция в учебные планы, пререквизиты, нагрузка на студентов.

Отвечай только на русском языке. Оставайся в роли партнёра до момента итоговой обратной связи.`;

function buildSystemPrompt(programs: string[], partner: string): string {
  const negotiationKb = getKb().negotiationKb;
  const kbParts = programs
    .map((p) => negotiationKb[p])
    .filter(Boolean)
    .join("\n\n---\n\n");

  return NEGOTIATION_SYSTEM_PROMPT
    .replace("{{PARTNER}}", partner)
    .replace("{{PRODUCTS}}", programs.join(", "))
    .replace(
      "{{KNOWLEDGE_BASE}}",
      kbParts || "База знаний не найдена для выбранных программ."
    );
}

// ── Route ─────────────────────────────────────────────────────────
router.post("/negotiate", async (req, res) => {
  const { messages, programs, partner } = req.body as {
    messages: OpenAI.ChatCompletionMessageParam[];
    programs: string[];
    partner: string;
  };

  if (!programs || programs.length === 0) {
    res.status(400).json({ error: "Не выбраны программы для тренировки" });
    return;
  }
  if (!partner) {
    res.status(400).json({ error: "Не указан тип партнёра" });
    return;
  }

  const kbData = getKb();
  if (Object.keys(kbData.negotiationKb).length === 0) {
    const msg = kbData.loadError
      ? `База знаний не загружена: ${kbData.loadError}`
      : "База знаний ещё загружается, попробуйте через несколько секунд";
    res.status(503).json({ error: msg });
    return;
  }

  const systemPrompt = buildSystemPrompt(programs, partner);

  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(messages ?? []),
  ];

  const completion = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: chatMessages,
    max_tokens: 1200,
    temperature: 0.75,
  });

  const result = completion.choices[0]?.message?.content ?? "";
  res.json({ result });
});

export default router;
