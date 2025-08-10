//
// Обновлённый JavaScript-файл для динамической фоновой анимации на Canvas.
// Использует debouncing для плавного изменения размера окна без мерцания.
//
// Инициализация Canvas и контекста
const canvas = document.getElementById('fractal-background');
const ctx = canvas.getContext('2d');

// Переменные для анимации
let width, height;
let particles = [];
// Уменьшено количество частиц с 100 до 75 для снижения нагрузки на ЦП.
// Вы можете изменить это значение, чтобы найти баланс между производительностью и визуальной плотностью.
const particleCount = 75;
const colorPalette = [
    'rgba(16, 163, 127, 0.8)', // Primary
    'rgba(13, 133, 104, 0.7)', // Primary Dark
    'rgba(129, 140, 248, 0.6)', // Accent
    'rgba(209, 213, 219, 0.5)', // Text secondary
];

//
// Класс для частицы
// Каждая частица имеет позицию, скорость и размер.
//
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
        this.color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    }

    // Обновление позиции частицы
    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Если частица ушла за границы, возвращаем её с противоположной стороны
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
        }
    }

    // Отрисовка частицы
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

//
// Инициализация анимации
// Задаём размеры канваса и создаём частицы.
//
function init() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(Math.random() * width, Math.random() * height));
    }
}

//
// Главный цикл анимации
// Очищает канвас и перерисовывает все частицы и соединительные линии.
//
function animate() {
    ctx.clearRect(0, 0, width, height);

    // Рисуем линии между близко расположенными частицами.
    // Этот двойной цикл является самой "тяжёлой" частью вычислений.
    for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const maxDist = 150;

            if (dist < maxDist) {
                const opacity = 1 - (dist / maxDist);
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.2})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }

    // Обновляем и рисуем все частицы
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // Запускаем следующий кадр
    requestAnimationFrame(animate);
}

//
// Обработчик изменения размера окна с debouncing
//
let resizeTimer;
function handleResize() {
    // Очищаем предыдущий таймер, если он есть
    clearTimeout(resizeTimer);
    // Запускаем новый таймер. Функция init() вызовется только через 250ms
    // после того, как пользователь перестанет менять размер окна.
    resizeTimer = setTimeout(() => {
        init();
    }, 250);
}

// Запускаем инициализацию при загрузке страницы
window.onload = function() {
    init();
    animate();
};

// Добавляем слушателя события resize
// Вместо прямого вызова init() мы используем наш debounced-обработчик
window.addEventListener('resize', handleResize);
