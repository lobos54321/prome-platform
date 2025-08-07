#!/bin/bash

# Test dialogue_count progression
CONV_ID="test-dialogue-$(date +%s)"
echo "🔍 测试对话计数递增功能"
echo "使用对话ID: $CONV_ID"
echo ""

echo "1️⃣ 发送第一条消息..."
response1=$(curl -s -m 5 -X POST "http://localhost:8080/api/dify/$CONV_ID/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "第一条消息"}' | grep "workflow_started" | head -1)

if [[ $response1 == *"dialogue_count"* ]]; then
    echo "✅ 找到第一条消息的workflow_started事件"
    dialogue_count1=$(echo "$response1" | sed 's/.*"dialogue_count": *\([0-9]*\).*/\1/')
    conv_id1=$(echo "$response1" | sed 's/.*"conversation_id": *"\([^"]*\)".*/\1/')
    echo "   📊 Dialogue Count: $dialogue_count1"
    echo "   🆔 Conversation ID: $conv_id1"
else
    echo "❌ 未找到workflow_started事件"
fi

echo ""
echo "⏳ 等待2秒..."
sleep 2

echo ""
echo "2️⃣ 发送第二条消息（使用相同conversation_id）..."
response2=$(curl -s -m 5 -X POST "http://localhost:8080/api/dify/$CONV_ID/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "第二条消息"}' | grep "workflow_started" | head -1)

if [[ $response2 == *"dialogue_count"* ]]; then
    echo "✅ 找到第二条消息的workflow_started事件"
    dialogue_count2=$(echo "$response2" | sed 's/.*"dialogue_count": *\([0-9]*\).*/\1/')
    conv_id2=$(echo "$response2" | sed 's/.*"conversation_id": *"\([^"]*\)".*/\1/')
    echo "   📊 Dialogue Count: $dialogue_count2"
    echo "   🆔 Conversation ID: $conv_id2"
else
    echo "❌ 未找到workflow_started事件"
fi

echo ""
echo "🔍 分析结果:"
echo "─────────────────────────────────────"

if [[ "$conv_id1" == "$conv_id2" ]]; then
    echo "✅ Conversation ID 保持一致"
else
    echo "❌ Conversation ID 不一致"
    echo "   第一条: $conv_id1"
    echo "   第二条: $conv_id2"
fi

if [[ "$dialogue_count2" -gt "$dialogue_count1" ]]; then
    echo "✅ Dialogue count 正确递增 ($dialogue_count1 → $dialogue_count2)"
    echo "💡 对话状态正确，应该能进入下一个节点"
else
    echo "❌ Dialogue count 没有递增 ($dialogue_count1 → $dialogue_count2)"
    echo "💡 这就是为什么一直卡在第一个节点的原因！"
fi