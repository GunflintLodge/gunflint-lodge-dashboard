/**
 * Gunflint Lodge Dashboard
 * Loads and displays operational data from operational-data-latest.json
 */

// Global state
let dashboardData = null;
let chart7Day = null;

// Data path (relative to this file's location)
const DATA_URL = './operational-data-latest.json';

// Update interval (15 minutes)
const REFRESH_INTERVAL = 15 * 60 * 1000;

/**
 * Load data from JSON file
 */
async function loadDashboardData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        return null;
    }
}

/**
 * Format currency
 */
function formatCurrency(value) {
    if (value === null || value === undefined) return '--';
    return parseFloat(value).toFixed(2);
}

/**
 * Format percentage
 */
function formatPercent(value) {
    if (value === null || value === undefined) return '--';
    return parseFloat(value).toFixed(1);
}

/**
 * Get status indicator for percentage change
 */
function getPerformanceIndicator(change) {
    if (change === null || change === undefined) return '--';
    change = parseFloat(change);
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '→';
}

/**
 * Get change CSS class
 */
function getChangeClass(change) {
    if (change === null || change === undefined) return '';
    change = parseFloat(change);
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return '';
}

/**
 * Format change text
 */
function formatChange(value) {
    if (value === null || value === undefined) return '--';
    value = parseFloat(value);
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * Update all dashboard elements
 */
function updateDashboard(data) {
    if (!data) {
        console.error('No data provided to updateDashboard');
        return;
    }

    dashboardData = data;

    // Update timestamp
    const lastUpdated = new Date(data.generated_at);
    document.getElementById('timestamp').textContent = lastUpdated.toLocaleString();
    document.getElementById('refreshTime').textContent = lastUpdated.toLocaleTimeString();

    // Today's metrics
    const today = data.today;
    document.getElementById('todayDate').textContent = today.date;
    document.getElementById('occupancyPct').textContent = formatPercent(today.occupancy_pct);
    document.getElementById('roomsSold').textContent = today.rooms_sold;
    document.getElementById('adr').textContent = formatCurrency(today.adr);
    document.getElementById('revpar').textContent = formatCurrency(today.revpar);

    // Today's revenue
    document.getElementById('roomRevenue').textContent = formatCurrency(today.room_revenue);
    document.getElementById('fbRevenue').textContent = formatCurrency(today.f_and_b_revenue);
    document.getElementById('foodRev').textContent = formatCurrency(today.food_revenue);
    document.getElementById('barRev').textContent = formatCurrency(today.bar_revenue);
    document.getElementById('giftRevenue').textContent = formatCurrency(today.gift_shop_revenue);
    document.getElementById('giftToday').textContent = formatCurrency(today.gift_shop_revenue);
    document.getElementById('totalRevenue').textContent = formatCurrency(today.total_revenue);

    // Spend per guest
    document.getElementById('spendPerGuest').textContent = formatCurrency(today.spend_per_guest);
    document.getElementById('personCount').textContent = Math.round(today.person_count);

    // MTD comparison
    const mtd = data.mtd;
    const lym = data.last_year_mtd;
    const kpis = data.kpis;

    document.getElementById('mtdOccupancy').textContent = formatPercent(mtd.occupancy_pct);
    document.getElementById('mtdOccupancyLY').textContent = formatPercent(lym.occupancy_pct);
    document.getElementById('occupancyIndicator').textContent = getPerformanceIndicator(kpis.occupancy_change_pts);
    document.getElementById('occupancyChange').textContent = `${formatChange(kpis.occupancy_change_pts)} pts`;
    document.getElementById('occupancyChange').className = getChangeClass(kpis.occupancy_change_pts);

    document.getElementById('mtdRevenue').textContent = formatCurrency(mtd.room_revenue);
    document.getElementById('mtdRevenueLY').textContent = formatCurrency(lym.room_revenue);
    document.getElementById('revenueIndicator').textContent = getPerformanceIndicator(kpis.room_revenue_growth_pct);
    document.getElementById('revenueChange').textContent = formatChange(kpis.room_revenue_growth_pct);
    document.getElementById('revenueChange').className = getChangeClass(kpis.room_revenue_growth_pct);

    document.getElementById('mtdADR').textContent = formatCurrency(mtd.adr);
    document.getElementById('mtdADRLY').textContent = formatCurrency(lym.adr);
    document.getElementById('adrIndicator').textContent = getPerformanceIndicator(kpis.adr_growth_pct);
    document.getElementById('adrChange').textContent = formatChange(kpis.adr_growth_pct);
    document.getElementById('adrChange').className = getChangeClass(kpis.adr_growth_pct);

    // F&B alert
    const fbChange = kpis.f_and_b_change_pct;
    document.getElementById('fbChange').textContent = formatChange(fbChange);
    document.getElementById('fbChangeVal').textContent = fbChange > 0 ? 'increased' : 'decreased';
    document.getElementById('fbChange').className = getChangeClass(fbChange) === 'negative' ? 'alert-negative' : 'alert-positive';

    // Gift shop alert
    const giftChange = kpis.gift_shop_change_pct;
    document.getElementById('giftChange').textContent = formatChange(giftChange);
    document.getElementById('giftChange').className = getChangeClass(giftChange);

    // Data status
    updateDataStatus(data.data_sources);

    // Draw 7-day chart
    draw7DayChart(data.forecast_7day);

    // Check for alerts
    checkAlerts(data);
}

/**
 * Update data source status indicators
 */
function updateDataStatus(sources) {
    // RoomMaster
    const rmStatus = document.getElementById('rmStatus');
    rmStatus.textContent = '●';
    rmStatus.className = sources.roommaster === 'direct_extraction' ? 'status-dot ok' : 'status-dot warning';

    // Aireus
    const aireusStatus = document.getElementById('aireusStatus');
    aireusStatus.textContent = '●';
    aireusStatus.className = sources.aireus === 'direct_extraction' ? 'status-dot ok' : 'status-dot warning';

    // Flybook
    const flybookStatus = document.getElementById('flybookStatus');
    flybookStatus.textContent = '●';
    flybookStatus.className = sources.flybook === 'pending' ? 'status-dot warning' : 'status-dot ok';
}

/**
 * Draw 7-day occupancy forecast chart
 */
function draw7DayChart(forecastData) {
    if (!forecastData || forecastData.length === 0) {
        console.warn('No forecast data available');
        return;
    }

    const ctx = document.getElementById('chart7day');
    if (!ctx) return;

    const labels = forecastData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const occupancyData = forecastData.map(d => parseFloat(d.occupancy_pct));
    const revenueData = forecastData.map(d => parseFloat(d.projected_revenue));

    // Destroy existing chart if any
    if (chart7Day) {
        chart7Day.destroy();
    }

    // Create new chart
    chart7Day = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Occupancy %',
                    data: occupancyData,
                    backgroundColor: 'rgba(45, 95, 63, 0.6)',
                    borderColor: 'rgb(45, 95, 63)',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: 'Projected Revenue',
                    data: revenueData,
                    borderColor: 'rgb(193, 122, 58)',
                    backgroundColor: 'rgba(193, 122, 58, 0.1)',
                    borderWidth: 2,
                    type: 'line',
                    yAxisID: 'y1',
                    tension: 0.4,
                    fill: true,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Occupancy %'
                    },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Revenue ($)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Check for alerts and display banner
 */
function checkAlerts(data) {
    const alerts = [];
    const kpis = data.kpis;
    const today = data.today;

    // Occupancy alert
    if (today.occupancy_pct < 15) {
        alerts.push(`⚠️ Low occupancy tonight: ${today.occupancy_pct}%`);
    }

    // F&B revenue alert
    if (kpis.f_and_b_change_pct < -40) {
        alerts.push(`⚠️ F&B revenue down ${Math.abs(kpis.f_and_b_change_pct).toFixed(1)}% YoY`);
    }

    // Revenue alert
    if (today.total_revenue < 2000) {
        alerts.push(`⚠️ Total revenue is low: $${today.total_revenue.toFixed(2)}`);
    }

    // Display alerts
    const banner = document.getElementById('alertBanner');
    if (alerts.length > 0) {
        banner.textContent = alerts.join(' | ');
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

/**
 * Initialize dashboard
 */
async function initializeDashboard() {
    console.log('Initializing dashboard...');

    // Load initial data
    const data = await loadDashboardData();
    if (data) {
        updateDashboard(data);
    } else {
        console.error('Failed to load initial data');
        document.querySelector('.dashboard').innerHTML += '<p style="color: red; padding: 2rem;">Error loading dashboard data. Please refresh the page.</p>';
    }

    // Set up auto-refresh
    setInterval(async () => {
        const newData = await loadDashboardData();
        if (newData) {
            updateDashboard(newData);
        }
    }, REFRESH_INTERVAL);

    console.log('Dashboard initialized. Auto-refresh every 15 minutes.');
}

/**
 * Start when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeDashboard);
