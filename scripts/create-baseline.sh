#!/bin/bash
# Frontend Project Baseline Script
# 为Frontend-PM创建项目基线验证

echo "📊 创建前端项目基线..."

# 检查关键文件存在性
FILES=(
    "src/main.tsx"
    "src/App.tsx" 
    "src/components/chat/ChatHistory.tsx"
    "src/components/chat/DifyChatInterface.tsx"
    "package.json"
    "vite.config.ts"
)

missing_files=0
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file 缺失"
        ((missing_files++))
    fi
done

# 检查依赖安装
if [[ -d "node_modules" ]]; then
    echo "✅ node_modules 已安装"
else
    echo "❌ node_modules 未安装"
    ((missing_files++))
fi

# 计算通过率
total_checks=7
passed_checks=$((total_checks - missing_files))
pass_rate=$((passed_checks * 100 / total_checks))

echo "📈 基线检查结果："
echo "   通过: $passed_checks/$total_checks"
echo "   通过率: $pass_rate%"

if [[ $pass_rate -ge 75 ]]; then
    echo "✅ 基线验证通过 (≥75%)"
    echo "$pass_rate" > /tmp/frontend_baseline_score
    exit 0
else
    echo "❌ 基线验证失败 (<75%)"
    echo "$pass_rate" > /tmp/frontend_baseline_score
    exit 1
fi