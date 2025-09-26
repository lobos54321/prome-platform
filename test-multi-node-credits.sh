#!/bin/bash

echo "🔧 测试多节点积分扣除功能"
echo "=========================="

SERVER_URL="http://localhost:3002"

echo "测试服务器: $SERVER_URL"
echo ""

# 测试1: 复杂工作流触发多个LLM节点
echo "📝 测试1: 复杂营销文案工作流（应触发多个LLM节点）"
echo "🎯 端点: /api/dify"
echo "💬 消息: 需要完整的营销策略和多个文案变体"
echo "---"

USER_ID="test-multinode-$(date +%s)"

echo "📤 发送复杂请求..."
RESPONSE1=$(curl -s -X POST "$SERVER_URL/api/dify" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"我需要为新款智能手表制作完整的营销策略，包括痛点分析、目标用户画像、以及3个不同风格的文案变体（专业版、情感版、年轻版）\",
    \"user\": \"$USER_ID\",
    \"conversation_id\": null,
    \"stream\": false
  }")

echo "📥 API 响应状态: $?"

if [ $? -eq 0 ]; then
  echo "✅ 请求成功"
  echo "响应预览:"
  echo "$RESPONSE1" | head -c 500
  echo "..."
  
  # 检查是否包含usage信息
  if echo "$RESPONSE1" | grep -q "usage"; then
    echo ""
    echo "✅ 发现usage信息 - 积分扣除应该已执行"
    
    # 尝试提取token数量
    TOTAL_TOKENS=$(echo "$RESPONSE1" | grep -o '"total_tokens":[0-9]*' | head -1 | grep -o '[0-9]*')
    if [ ! -z "$TOTAL_TOKENS" ]; then
      echo "📊 检测到总token使用量: $TOTAL_TOKENS"
      if [ "$TOTAL_TOKENS" -gt 10000 ]; then
        echo "⚡ 高token使用量检测 - 可能涉及多个LLM节点"
      fi
    fi
  else
    echo ""
    echo "⚠️ 未发现usage信息"
  fi
else
  echo "❌ 请求失败"
fi

echo ""
echo "=============================================="
echo ""

# 测试2: 流式响应测试（更容易看到单独的节点）
echo "📝 测试2: 流式响应中的节点级积分扣除"
echo "🎯 端点: /api/dify (stream=true)"
echo "💬 消息: 创建复杂营销方案"
echo "---"

USER_ID2="test-stream-$(date +%s)"

echo "📤 发送流式请求..."
echo "💡 注意：检查服务器日志以查看逐节点的积分扣除"

# 创建一个小的流式测试
curl -s -X POST "$SERVER_URL/api/dify" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"帮我为高端咖啡品牌设计完整的营销活动，包括品牌定位、目标受众分析、核心卖点提炼和创意文案\",
    \"user\": \"$USER_ID2\",
    \"conversation_id\": null,
    \"stream\": true
  }" | head -c 1000

echo ""
echo ""
echo "=============================================="
echo ""
echo "🔍 验证要点："
echo "---"
echo "✅ 服务器日志中查找："
echo "   - '🎯 检测到LLM节点完成，处理积分扣除'"
echo "   - '✅ LLM节点积分扣除完成'"
echo "   - '📤 积分扣除通知已发送到前端'"
echo ""
echo "🔧 每个LLM节点应该："
echo "   1. 单独检测和处理token使用"
echo "   2. 独立扣除积分"
echo "   3. 发送节点级通知给前端"
echo "   4. 记录详细的节点信息（ID、标题、类型）"
echo ""
echo "💡 多节点工作流特征："
echo "   - 总token使用量通常较高（>5000 tokens）"
echo "   - 可能包含LLM0, LLM14, LLM11等多个节点"
echo "   - 每个节点都有独立的usage统计"
echo ""
echo "查看服务器控制台输出以确认节点级积分扣除是否正常工作..."