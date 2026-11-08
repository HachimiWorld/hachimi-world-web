import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/square',
      name: 'square',
      component: () => import('../views/SquareView.vue'),
    },
    {
      path: '/square/moment/:id',
      name: 'moment-detail',
      component: () => import('../views/MomentDetailView.vue'),
    },
    {
      path: '/square/event/:id',
      name: 'event-detail',
      component: () => import('../views/EventDetailView.vue'),
    },
    {
      path: '/square/:id(\\d+)',
      redirect: (to) => `/square/moment/${to.params.id}`,
    },

    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue'),
    },

    {
      path: '/upvote',
      name: 'upvote',
      component: () => import('../views/UpvoteView.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
    {
      path: '/playlist',
      name: 'playlist',
      component: () => import('../views/PlaylistView.vue'),
    },
    {
      path: '/feed',
      name: 'feed',
      component: () => import('../views/FeedView.vue'),
    },
    {
      path: '/messages',
      name: 'messages',
      component: () => import('../views/MessagesView.vue'),
    },
    {
      path: '/messages/system',
      name: 'messages-system',
      component: () => import('../views/MessageSystemView.vue'),
    },
    {
      path: '/messages/system/:id',
      name: 'messages-system-detail',
      component: () => import('../views/MessageDetailView.vue'),
    },
    {
      path: '/messages/likes',
      name: 'messages-likes',
      component: () => import('../views/MessageLikesView.vue'),
    },
    {
      path: '/messages/replies',
      name: 'messages-replies',
      component: () => import('../views/MessageRepliesView.vue'),
    },
    {
      path: '/messages/followers',
      name: 'messages-followers',
      component: () => import('../views/MessageFollowersView.vue'),
    },

    {
      path: '/followers',
      name: 'followers',
      component: () => import('../views/FollowersView.vue'),
    },
    {
      path: '/create',
      name: 'create',
      component: () => import('../views/CreateView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/user/:uid',
      name: 'user',
      component: () => import('../views/UserView.vue'),
    },
    {
      path: '/song/:id',
      name: 'song-detail',
      component: () => import('../views/SongDetailView.vue'),
    },
    {
      path: '/playlist/:id',
      name: 'playlist-detail',
      component: () => import('../views/PlaylistDetailView.vue'),
    },
    {
      path: '/recent',
      name: 'recent',
      component: () => import('../views/RecentView.vue'),
    },
    {
      path: '/hot',
      name: 'hot',
      component: () => import('../views/HotView.vue'),
    },
    {
      path: '/recommend',
      name: 'recommend',
      component: () => import('../views/RecommendView.vue'),
    },
    {
      path: '/tag/:name',
      name: 'tag',
      component: () => import('../views/TagView.vue'),
    },
  ],
})

export default router
