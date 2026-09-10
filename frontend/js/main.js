import { auth } from './api.js';
import { route } from './router.js';

// 初始化角色选择器
const roleSelect = document.getElementById('roleSelect');
roleSelect.value = auth.role;
roleSelect.addEventListener('change', () => {
  auth.setRole(roleSelect.value);
  route(); // 切换角色后重渲染当前页（草稿显隐、编辑按钮即时变化）
});

window.addEventListener('hashchange', route);
route();
