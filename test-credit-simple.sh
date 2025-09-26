#!/bin/bash

echo "🔧 测试积分扣除功能"
echo "========================"

SERVER_URL="http://localhost:3002"

echo "测试服务器: $SERVER_URL"
echo ""

# 测试1: 营销文案生成（应该触发LLM节点和积分扣除）
echo "📝 测试1: 营销文案生成积分扣除"
echo "🎯 端点: /api/dify"
echo "💬 消息: 帮我写手机营销文案"
echo "---"

USER_ID="test-credit-$(date +%s)"

echo "📤 发送请求..."
RESPONSE1=$(curl -s -X POST "$SERVER_URL/api/dify" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"帮我写一个卖手机的营销文案，产品是iPhone 15，目标用户是年轻人\",
    \"user\": \"$USER_ID\",
    \"conversation_id\": null,
    \"stream\": false
  }")

echo "📥 API 响应状态: $?"

if [ $? -eq 0 ]; then
  echo "✅ 请求成功"
  echo "响应预览:"
  echo "$RESPONSE1" | head -c 300
  echo "..."
  
  # 检查是否包含usage信息
  if echo "$RESPONSE1" | grep -q "usage"; then
    echo ""
    echo "✅ 发现usage信息 - 积分扣除应该已执行"
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

# 测试2: Workflow端点
echo "📝 测试2: Workflow端点积分扣除"
echo "🎯 端点: /api/dify/workflow"
echo "💬 消息: 营销文案需求"
echo "---"

USER_ID2="test-workflow-$(date +%s)"

echo "📤 发送请求..."
RESPONSE2=$(curl -s -X POST "$SERVER_URL/api/dify/workflow" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"我需要一个关于咖啡的营销文案\",
    \"user\": \"$USER_ID2\",
    \"conversation_id\": null,
    \"stream\": false
  }")

echo "📥 API 响应状态: $?"

if [ $? -eq 0 ]; then
  echo "✅ 请求成功"
  echo "响应预览:"
  echo "$RESPONSE2" | head -c 300
  echo "..."
  
  # 检查是否包含usage信息
  if echo "$RESPONSE2" | grep -q "usage"; then
    echo ""
    echo "✅ 发现usage信息 - 积分扣除应该已执行"
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
echo "🎉 积分扣除测试完成！"
echo ""
echo "💡 验证要点："
echo "---"
echo "✅ 检查内容："
echo "   1. API响应包含usage元数据"
echo "   2. 服务器控制台显示积分扣除日志"
echo "   3. 数据库中记录了token使用"
echo ""
echo "🔧 查看服务器日志以确认积分扣除："
echo "   查找关键词: 'processTokenUsageAndDeductCredits', 'Credit deduction successful'"