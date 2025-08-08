import Vue from 'vue'
import VueRouter from 'vue-router'


Vue.use(VueRouter)

const routes = [
  // {
  //   path: '/',
  //   name: 'home',
  //   component: HomeView
  // },
  // {
  //   path: '/about',
  //   name: 'about',
  //   // route level code-splitting
  //   // this generates a separate chunk (about.[hash].js) for this route
  //   // which is lazy-loaded when the route is visited.
  //   component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  // },
   {
  path: '/',
  name: 'LoginFunc',
  component: () => import('@/views/LoginFunc.vue')
},
  {
    path: '/chat/:encodedId',
    name: 'UserChat',
    component: () => import('@/views/UserChat.vue'), // 确保组件路径正确
    props: (route) => ({
    userId: decodeURIComponent(route.params.encodedId)
  })
  },
  {
    path: '/',
    name: 'Login',
    component: () => import('@/App.vue') // 确保路径正确
  }

]
//创建router实例
const router = new VueRouter({
  routes
})

/* 路由守卫，全局前置守卫
功能：路由跳转之前拦截请求（路由切换请求）、身份验证（验证当前用户是否登录）、访问控制（禁止未授权的用户访问UserChat）、重定向到首页
 */
router.beforeEach((to, from, next) => {
  const storedUserId = sessionStorage.getItem('userId');

  // 访问 UserChat 页面
  if (to.name === 'UserChat') {
    const targetUserId = decodeURIComponent(to.params.encodedId);

    // 未登录或目标 ID 与本地 ID 不一致，则跳回登录页
    if (!storedUserId || storedUserId !== targetUserId) {
      return next('/');
    }
  }

  next(); // 放行
});

// 1. 解决重复导航错误
const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push(location) {
  return originalPush.call(this, location).catch(err => {
    if (err.name !== 'NavigationDuplicated') throw err
  })
}

// 2. 全局路由错误处理
router.onError((error) => {
  console.error('路由错误:', error)
  // 可以在这里添加错误上报逻辑
})
export default router

