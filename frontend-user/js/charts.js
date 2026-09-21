/* ========================================
   图表组件
   ======================================== */

class ChartManager {
    constructor() {
        // 已初始化的图表实例: { funnel: echartsInstance, radar: ... }
        this.charts = {};
        // 每个图表对应的容器尺寸监听器
        this.resizeObservers = {};
        // 尺寸变化后的延迟重绘定时器
        this.resizeTimers = {};

        this._handleWindowResize = () => this.scheduleResize();

        // window resize / 横竖屏切换作为兜底（容器自身尺寸由 ResizeObserver 监听）
        window.addEventListener('resize', this._handleWindowResize);
        window.addEventListener('orientationchange', this._handleWindowResize);
    }

    // 获取（或清理后重建）指定容器上的图表实例，避免销毁后重新初始化时残留旧实例
    _createChart(key, container) {
        const existing = echarts.getInstanceByDom(container);
        if (existing) {
            if (this.resizeObservers[key]) {
                this.resizeObservers[key].disconnect();
                delete this.resizeObservers[key];
            }
            existing.dispose();
        }

        const chart = echarts.init(container);
        this.charts[key] = chart;

        // 监听容器尺寸变化：窗口缩放、窄屏/宽屏断点切换都会触发，自动重绘
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => this.scheduleResize(key));
            observer.observe(container);
            this.resizeObservers[key] = observer;
        }

        return chart;
    }

    // 数据缺失时的统一占位配置（沿用页面既有的灰/紫配色，不引入新色系）
    _emptyOption(text, subtext) {
        return {
            backgroundColor: 'transparent',
            title: {
                text: `📭 ${text}`,
                subtext: subtext || '该分群暂无样本，数据缺失',
                left: 'center',
                top: 'center',
                textStyle: {
                    color: '#94a3b8',
                    fontSize: 16,
                    fontWeight: 600
                },
                subtextStyle: {
                    color: '#64748b',
                    fontSize: 13
                },
                itemGap: 10
            }
        };
    }

    // 初始化漏斗图。data 为某个分群的漏斗数据，缺失（空数组/全部无值）时展示缺失说明
    initFunnelChart(containerId, data = funnelData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = this._createChart('funnel', container);

        const validData = (Array.isArray(data) ? data : [])
            .filter(item => item && item.value !== null && item.value !== undefined && !isNaN(item.value));

        // 该分群没有任何样本：展示数据缺失说明，而不是把漏斗渲染成 0
        if (validData.length === 0) {
            chart.setOption(this._emptyOption('暂无样本数据'), true);
            return chart;
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}%',
                backgroundColor: 'rgba(20, 20, 35, 0.95)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderWidth: 1,
                textStyle: { color: '#f8fafc' },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
            },
            series: [{
                type: 'funnel',
                left: '10%',
                right: '10%',
                top: '8%',
                bottom: '8%',
                width: '80%',
                min: 0,
                max: 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 3,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}\n{c}%',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                },
                labelLine: { show: false },
                itemStyle: {
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: 'rgba(168, 85, 247, 0.3)'
                },
                emphasis: {
                    label: { fontSize: 15 },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowColor: 'rgba(168, 85, 247, 0.5)'
                    }
                },
                data: validData.map(item => ({
                    value: item.value,
                    name: item.name,
                    itemStyle: { color: item.color }
                }))
            }]
        };

        chart.setOption(option, true);

        // 点击事件：名称与数值一一对应（保持原有提示内容与配色不变）
        chart.on('click', (params) => {
            if (params.name === undefined || params.name === null || params.name === '') return;
            window.toast.info('漏斗分析', `${params.name}: 转化率 ${params.value}%`);
        });

        return chart;
    }

    // 初始化雷达图。data 为某个分群集合的雷达数据；
    // 整个分群集合无样本时展示缺失说明；单个分群缺测的维度按“数据缺失”处理，不显示成 0
    initRadarChart(containerId, data = radarData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = this._createChart('radar', container);

        const indicators = (data && Array.isArray(data.indicators)) ? data.indicators : [];
        // 只保留至少存在一个有效数值的分群；整条序列缺失则不绘制，避免渲染为贴中心的 0 值多边形
        const validSeries = (data && Array.isArray(data.series) ? data.series : []).filter(s => {
            return s && Array.isArray(s.value) && s.value.some(v => typeof v === 'number' && !isNaN(v));
        });

        if (indicators.length === 0 || validSeries.length === 0) {
            chart.setOption(this._emptyOption('暂无样本数据'), true);
            return chart;
        }

        const layout = this._computeRadarLayout(container);

        const formatValueList = (values) => indicators.map((ind, i) => {
            const v = values[i];
            const valueText = (typeof v === 'number' && !isNaN(v))
                ? v
                : '<span style="color:#f59e0b;">数据缺失</span>';
            return `<div style="display:flex;justify-content:space-between;gap:16px;line-height:1.8;">
                        <span style="color:#94a3b8;">${ind.name}</span>
                        <span style="color:#f8fafc;font-weight:600;">${valueText}</span>
                    </div>`;
        }).join('');

        const option = {
            backgroundColor: 'transparent',
            legend: {
                data: validSeries.map(s => s.name),
                bottom: 0,
                textStyle: { color: '#94a3b8', fontSize: 12 },
                itemWidth: 16,
                itemHeight: 10,
                itemGap: 20
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(20, 20, 35, 0.95)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderWidth: 1,
                textStyle: { color: '#f8fafc' },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;',
                // 显式按“维度名: 数值”逐行配对，避免默认模板在缺值时把名称与数值对错位
                formatter: (params) => {
                    const values = Array.isArray(params.value) ? params.value : [];
                    return `<div style="font-weight:700;margin-bottom:4px;">${params.name}</div>${formatValueList(values)}`;
                }
            },
            radar: {
                indicator: indicators,
                shape: 'polygon',
                splitNumber: 4,
                center: layout.center,
                radius: layout.radius,
                axisName: {
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 500
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(168, 85, 247, 0.15)',
                        width: 1
                    }
                },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(168, 85, 247, 0.02)', 'rgba(168, 85, 247, 0.06)']
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(168, 85, 247, 0.2)'
                    }
                }
            },
            series: [{
                type: 'radar',
                data: validSeries.map(s => ({
                    value: s.value,
                    name: s.name,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        color: s.color,
                        width: 2,
                        shadowBlur: 10,
                        shadowColor: s.color
                    },
                    areaStyle: { color: s.areaColor },
                    itemStyle: {
                        color: s.color,
                        borderColor: '#fff',
                        borderWidth: 2
                    }
                }))
            }]
        };

        chart.setOption(option, true);

        // 点击事件：params.name 是分群（序列）名称，params.value 是各维度数值数组，
        // 逐维度把名称与数值对应展示，缺测维度标注“数据缺失”，不再出现名称数值错位
        chart.on('click', (params) => {
            const name = params.name;
            if (!name) return;
            const values = Array.isArray(params.value) ? params.value : [];
            const avg = values.filter(v => typeof v === 'number' && !isNaN(v));
            const avgText = avg.length
                ? (avg.reduce((sum, v) => sum + v, 0) / avg.length).toFixed(1)
                : null;

            let message = `<div style="font-weight:700;margin-bottom:4px;">${name}</div><div>${formatValueList(values)}</div>`;
            if (avgText !== null) {
                message += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.25);color:#94a3b8;">综合均分：<span style="color:#f8fafc;font-weight:700;">${avgText}</span> / 100</div>`;
            }
            window.toast.info('能力对比', message);
        });

        return chart;
    }

    // 依据容器实际尺寸计算雷达几何参数：为底部图例、四周坐标名称预留空间，
    // 保证任意屏宽（含窄屏单列布局）下图例都不会遮住坐标标注
    _computeRadarLayout(container) {
        const width = container.clientWidth || 400;
        const height = container.clientHeight || 320;
        const sidePad = 72;                 // 左右留给轴名称
        const topPad = 20;                  // 顶部留给轴名称
        const legendReserve = 40;           // 底部图例高度
        const bottomPad = legendReserve + 12;

        const drawWidth = Math.max(width - sidePad * 2, 80);
        const drawHeight = Math.max(height - topPad - bottomPad, 80);

        return {
            center: [width / 2, topPad + drawHeight / 2],
            radius: Math.floor(Math.min(drawWidth / 2, drawHeight / 2))
        };
    }

    // 延迟重绘（防抖）。key 缺省时重绘全部图表
    scheduleResize(key) {
        if (key) {
            clearTimeout(this.resizeTimers[key]);
            this.resizeTimers[key] = setTimeout(() => this.resize(key), 150);
        } else {
            Object.keys(this.charts).forEach(k => this.scheduleResize(k));
        }
    }

    // 响应式调整
    resize(key) {
        const keys = key ? [key] : Object.keys(this.charts);
        keys.forEach(k => {
            const chart = this.charts[k];
            const container = chart && chart.getDom && chart.getDom();
            // 容器已脱离文档或尺寸为 0（如折叠隐藏）时跳过，恢复可见后 ResizeObserver 会再次触发
            if (!chart || !container || !container.isConnected) return;
            if (container.clientWidth === 0 || container.clientHeight === 0) return;

            chart.resize();

            // 雷达图需要同步重算几何布局，确保缩放后图例与坐标标注仍不重叠
            if (k === 'radar') {
                const layout = this._computeRadarLayout(container);
                chart.setOption({
                    radar: { center: layout.center, radius: layout.radius }
                });
            }
        });
    }

    // 销毁图表及所有监听器
    dispose() {
        Object.keys(this.resizeObservers).forEach(key => {
            this.resizeObservers[key].disconnect();
        });
        this.resizeObservers = {};

        Object.values(this.charts).forEach(chart => {
            if (chart && !chart.isDisposed()) {
                chart.dispose();
            }
        });
        this.charts = {};
        this.resizeTimers = {};
    }
}

// 创建全局实例
window.chartManager = new ChartManager();
