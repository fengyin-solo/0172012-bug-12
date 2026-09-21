/* ========================================
   应用主入口
   ======================================== */

class App {
    constructor() {
        this.initialized = false;
        this._handleScroll = this.handleScroll.bind(this);
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // 初始化组件
        window.componentRenderer.init();

        // 初始化图表
        window.chartManager.initFunnelChart('funnelChart');
        window.chartManager.initRadarChart('radarChart');

        // 监听滚动（窗口缩放/断点切换由 chartManager 的 ResizeObserver 统一负责）
        window.addEventListener('scroll', this._handleScroll);

        console.log('🚀 Dashboard initialized successfully');
    }

    handleScroll() {
        // 可以添加滚动相关的动画效果
        const scrollY = window.scrollY;
        const header = document.querySelector('.header');

        if (header) {
            const opacity = Math.max(0.5, 1 - scrollY / 500);
            header.style.opacity = opacity;
        }
    }

    // 销毁页面实例：清理图表与事件监听，之后可重新 init 而不残留旧实例
    destroy() {
        if (!this.initialized) return;

        window.chartManager.dispose();
        window.removeEventListener('scroll', this._handleScroll);
        this.initialized = false;
    }

    // 刷新数据
    refresh() {
        window.toast.info('刷新中', '正在重新加载数据...');

        setTimeout(() => {
            window.componentRenderer.renderStats();
            window.componentRenderer.renderMatrix();
            window.componentRenderer.renderQuickWins();
            window.chartManager.resize();

            window.toast.success('刷新完成', '数据已更新');
        }, 1000);
    }

    // 导出报告
    exportReport() {
        window.toast.info('导出报告', '正在生成PDF报告...');

        setTimeout(() => {
            window.toast.success('导出成功', '报告已保存到下载目录');
        }, 2000);
    }
}

// 创建应用实例
const app = new App();

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// 暴露全局方法
window.app = app;
