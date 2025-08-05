<template>
  <div id="chat-container">
    <!-- 背景 -->
    <div class="background"></div>

    <!-- 左侧侧边栏 -->
    <div class="sidebar">
      <div class="user-info">
        <div class="user-avatar" v-if="userAvatar" @click="openUserInfoDialog">
          <img :src="userAvatar" alt="用户头像">
        </div>
        <p class="user-nickname">{{ nickname }}</p>
      </div>

      <!-- 功能按钮 -->
      <div class="nav-buttons">
        <el-tooltip content="私聊" placement="right">
        <el-button @click="goToChat" icon="el-icon-chat-line-round" circle></el-button>
        </el-tooltip>

        <el-tooltip content="好友&群组" placement="right">
        <el-button @click="goToFriends" icon="el-icon-user" circle></el-button>
        </el-tooltip>

        <el-tooltip content="群聊" placement="right">
        <el-button @click="goToWorld" icon="el-icon-position" circle></el-button>
        </el-tooltip>

      </div>
    </div>
    <!-- 右上角退出按钮 -->
    <div class="logout-button">
      <el-button @click="logout" icon="el-icon-switch-button" circle></el-button>
    </div>
    <!-- 中间区域 -->
    <div class="main-content">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input v-model="searchQuery" placeholder="搜索好友/WeChat用户/群聊" prefix-icon="el-icon-search"
          @keyup.enter.native="handleSearch" @focus="clearSearchResults" @input="clearSearchResults"></el-input>
      </div>

      <!-- 功能页面内容 -->
      <div class="content">
        <!-- 当前组件是selectUser才进行user传递-->
        <component :is="currentComponent" :user="selectedUser" :nickName="nickname" :myId="id" :myNickName="nickname"
          :myAvatar="userAvatar" :friendsList="groupedFriends" :groupsList="groupedGroups "  @refresh-groups="loadGroupedGroups" />


      </div>
    </div>

    <!-- 右侧区域(搜索显示) -->
    <div class="right-panel" v-if="showSearchResults">
      <div class="search-results">
  <h4>搜索结果</h4>

  <!-- 用户结果 -->
  <div v-if="searchResults&&searchResults.length">
    <p>用户</p>
    <ul>
      <li v-for="user in searchResults" :key="'user-' + user.id" @click="selectUser(user)">
        <img :src="user.image" alt="头像" class="result-avatar">
        <span>{{ user.nickName }} ({{ user.accountId }})</span>
      </li>
    </ul>
  </div>

  <!-- 群聊结果 -->
  <div v-if="groupSearchResults&&groupSearchResults.length">
    <p>群聊</p>
    <ul>
      <li v-for="group in groupSearchResults" :key="'group-' + group.id" class="group-result">
        <img :src="group.image" alt="群头像" class="result-avatar">
        <div class="group-info">
          <div>{{ group.name }}</div>
          <div style="font-size: 12px; color: #666;">ID: {{ group.groupIdentifyId }}</div>
        </div>
        <el-button
          v-if="!group.joined"
          size="mini"
          type="primary"
          @click.stop="confirmJoinGroup(group)"
        >
          加入群聊
        </el-button>
        <span v-else style="font-size: 12px; color: green;">已加入</span>
      </li>
    </ul>
  </div>
</div>

    </div>
     <!-- 用户信息展示弹窗 -->
    <el-dialog 
      :visible.sync="showUserInfoDialog" 
      width="400px"
      :show-close="false"
      custom-class="user-info-dialog"
      :modal="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="user-info-content">
        <div class="avatar-container">
          <img :src="userAvatar" alt="用户头像" class="large-avatar">
          <el-button 
            type="text" 
            icon="el-icon-edit" 
            class="edit-avatar-btn"
            @click="openEditDialog"
          ></el-button>
        </div>
        <div class="user-details">
          <p class="nickname">{{ nickname }}</p>
          <p class="account-id">账号: {{ userId }}</p>
        </div>
      </div>
      <div class="dialog-footer">
        <el-button type="primary" @click="openEditDialog">编辑资料</el-button>
        <el-button @click="showUserInfoDialog = false">关闭</el-button>
      </div>
    </el-dialog>

    <!-- 编辑资料弹窗 -->
    <el-dialog 
      title="编辑个人资料" 
      :visible.sync="showEditDialog" 
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="头像">
          <div class="avatar-uploader">
            <img v-if="editForm.image" :src="editForm.image" class="avatar">
            <i v-else class="el-icon-plus avatar-uploader-icon"></i>
            <input 
              type="file" 
              accept="image/*" 
              @change="handleAvatarChange"
              class="avatar-upload-input"
            >
          </div>
          <p class="upload-tip">点击上方区域上传新头像</p>
        </el-form-item>
        
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickName" placeholder="请输入新昵称"></el-input>
        </el-form-item>
      </el-form>
      
      <div slot="footer" class="dialog-footer">
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveProfile" :disabled="!isFormChanged">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios';
import ChatFunc from './ChatFunc.vue';
import FriendFunc from './FriendFunc.vue';
import WorldFunc from './WorldFunc.vue';
import UserDetail from './UserDetail.vue';
export default {
  data() {
    return {
      userAvatar: '',
      nickname: '',
      id: null,
      searchQuery: '',
      showSearchResults: false,
      searchResults: [],
      currentComponent: null, // 当前显示的组件
      selectedUser: null,
      friendsList: [],// 好友列表
      groupedFriends: {
        '置顶': [],
        '好友': [],
        '拉黑': []
      },
      lastLoadTime: 0,
      loadCooldown: 1000, // 1秒内不再重复加载
      groupSearchResults: [], // 群聊搜索结果
      groupedGroups: {}, // 群聊分组数据
       showUserInfoDialog: false, // 控制用户信息弹窗显示
      showEditDialog: false,    // 控制编辑弹窗显示
      accountId: localStorage.getItem('accountId') || '', // 账号ID
      editForm: {
        nickName: '',
        image: '',
        originalNickName: '',
        originalImage: ''
      },
      avatarFile: null
    };
  },
   computed: {
    // 检查表单是否有变化
    isFormChanged() {
      return this.editForm.nickName !== this.editForm.originalNickName || 
             this.editForm.image !== this.editForm.originalImage;
    }
  },
  async created() {
    // 从 localStorage浏览器缓存 获取用户信息
    this.userAvatar = localStorage.getItem('userAvatar') || '';
    this.nickname = localStorage.getItem('nickName') || '用户';
    this.id = Number(localStorage.getItem('id')) || null;
    this.userId=localStorage.getItem('userId')
    this.status = Number(localStorage.getItem('status'));
    // 默认显示聊天组件
    this.currentComponent = 'ChatFunc';
    await this.loadFriendsList();//请求好友列表数据
    window.addEventListener('beforeunload', this.handleWindowClose);
    await this.loadGroupedGroups(); // 加载群聊分组
  },
  methods: {
     // 打开用户信息弹窗
    openUserInfoDialog() {
      this.showUserInfoDialog = true;
    },
    
    // 打开编辑弹窗
    openEditDialog() {
      this.showUserInfoDialog = false;
      this.editForm = {
        nickName: this.nickname,
        image: this.userAvatar,
        originalNickName: this.nickname,
        originalImage: this.userAvatar
      };
      this.avatarFile = null;
      this.showEditDialog = true;
    },
    
    // 处理头像选择
    handleAvatarChange(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // 验证文件类型
      if (!file.type.match('image.*')) {
        this.$message.error('请选择图片文件');
        return;
      }
      
      // 验证文件大小 (限制2MB)
      if (file.size > 100 * 1024 * 1024) {
        this.$message.error('图片大小不能超过100MB');
        return;
      }
      
      // 预览图片
      const reader = new FileReader();
      reader.onload = (e) => {
        this.editForm.image = e.target.result;
      };
      reader.readAsDataURL(file);
      
      this.avatarFile = file;
    },
    
    // 保存个人资料
    async saveProfile() {
      if (!this.isFormChanged) {
        this.$message.warning('未做任何修改');
        return;
      }
      
      try {
        // 如果有新头像，先上传头像
        if (this.avatarFile) {
          const formData = new FormData();
          formData.append('image', this.avatarFile);
          
          const uploadRes = await axios.post('http://localhost:8081/api/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          if (uploadRes.data.code === 200) {
            this.editForm.image = uploadRes.data.data;
          } else {
            throw new Error('头像上传失败');
          }
        }
        
        // 更新个人资料
        const updateRes = await axios.post('http://localhost:8081/api/editAccountInfo', {
          id: this.id,
          nickName: this.editForm.nickName,
          image: this.editForm.image
        });
        
        if (updateRes.data.code === 200) {
          this.$message.success('个人资料更新成功');
          
          // 更新本地存储和显示
          localStorage.setItem('nickName', this.editForm.nickName);
          localStorage.setItem('userAvatar', this.editForm.image);
          this.nickname = this.editForm.nickName;
          this.userAvatar = this.editForm.image;
          
          this.showEditDialog = false;
        } else {
          this.$message.error('个人资料更新失败');
        }
      } catch (error) {
        console.error('保存个人资料失败:', error);
        this.$message.error('保存失败，请重试');
      }
    },
    async logout() {
      try {
        // 调用后端接口设置用户状态为离线
        const response = await axios.post('http://localhost:8081/api/logoutset', {
          id: this.id
        }, {
          timeout: 2000
        });

        if (response.data.code == 200) {
          // 清除本地存储的用户信息
          localStorage.clear();

          // 跳转到登录页
          window.location.href = '/';//硬刷新，确保完全重置
        }
        else {
          this.$message.error('状态更新失败');
        }


      } catch (err) {
        this.$message.error('退出失败，请重试');
        console.error('退出账户失败:', err);
      }
    },
    //关闭页面时自动下线
    beforeUnmount() {
      if (this.id) {
        axios.post('http://localhost:8081/api/logoutset', {
          id: this.id
        }, {
          timeout: 2000
        }).catch(err => {

          console.error('页面关闭时设置下线状态失败:', err);
        });
      }
      if (this.tokenCheckInterval) {
        clearInterval(this.tokenCheckInterval);
      }
    },
    async handleWindowClose() {
      if (this.id) {
    // 使用 fetch 替代 navigator.sendBeacon
    fetch('http://localhost:8081/api/logoutset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: this.id }),
      credentials: 'include' // 包含凭证
    }).catch(err => {
      console.error('页面关闭时设置下线状态失败:', err);
    });
  }

    },
    // 点击功能按钮切换组件
    async goToChat() {
      const now = Date.now();
      if (now - this.lastLoadTime > this.loadCooldown) {
        this.lastLoadTime = now;
        this.currentComponent = 'ChatFunc';
        await this.loadFriendsList();//点击间隔时间超过1秒再进行更新
      }
    },
    goToFriends() {
      this.currentComponent = 'FriendFunc';
    },
    async goToWorld() {
      //加入节流逻辑，防止点击过快
      const now = Date.now();
    if (now - this.lastLoadTime > this.loadCooldown) {
      this.lastLoadTime = now;
      this.currentComponent = 'WorldFunc';
      await this.loadGroupedGroups();
  }
    },
    //重新点击搜索框进行清空
    clearSearchResults() {
      this.showSearchResults = false;
      this.searchResults = [];
      this.selectedUser = null;
      this.currentComponent = 'ChatFunc'; // 或你默认的组件
    },
    // 处理搜索（用户&群聊）
    async handleSearch() {
  const query = this.searchQuery.trim();
  if (!query) return;

  this.selectedUser = null;

  try {
    // 搜索用户
    const userRes = await axios.post('http://localhost:8081/api/fuzzysearchaccountbyIdentifier', {
      identifier: query
    });

    if (userRes.data.code === 200) {
      this.searchResults = userRes.data.data;
    } else {
      this.searchResults = [];
    }

    // 搜索群聊
    const groupRes = await axios.post('http://localhost:8081/group/fuzzysrch', {
      identifier: query
    });

    if (groupRes.data.code === 200) {
      const allGroups = groupRes.data.data || [];

      // 查询当前用户已加入的群聊列表
      const myGroupRel = await axios.post('http://localhost:8081/group/searchMyGR', {
        accountId: this.id // 注意拼写
      });

      const joinedGroupIds = (myGroupRel.data.data || []).map(gr => gr.groupId);

      // 给群聊加上是否已加入标记
      this.groupSearchResults = allGroups.map(g => ({
        ...g,
        joined: joinedGroupIds.includes(g.id)
      }));
    } else {
      this.groupSearchResults = [];
    }

    this.showSearchResults = true;
  } catch (err) {
    this.$message.error('搜索失败，请稍后再试');
    console.error(err);
  }
}
,

    // 点击搜索结果
    async selectUser(user) {
      console.log('点击的用户：', user);
      const currentNickName = this.nickname; // 当前登录用户的昵称


      try {
        // 查询与目标用户的关系
        const res = await axios.post('http://localhost:8081/api/searchfs', {
          nickName: currentNickName
        });

        if (res.data.code === 200) {
          const friendships = res.data.data || [];
          const isFriend = friendships.some(
            f => (f.id1 === this.id || f.id2 === user.id) && (f.id1 === this.id || f.id2 === user.id)
          );

          // 保存目标用户信息
          this.selectedUser = {
            ...user,
            isFriend,
            accountId: user.accountId,
            remark: isFriend ? '好友' : '普通用户'
          };

          this.showSearchResults = false;
          this.searchQuery = '';
          this.currentComponent = 'UserDetail'; // 切换到用户详情组件
        }
      } catch (err) {
        this.$message.error('查询好友关系失败');
        console.error(err);
      }
    },

    async groupFriends(list) {
      this.groupedFriends = {
        '置顶': [],
        '好友': [],
        '拉黑': []
      };

      if (!list || !Array.isArray(list)) return;

      for (const f of list) {
        // 确定当前用户是 id1 还是 id2
        const friendId = f.id1 === this.id ? f.id2 : f.id1;
        if (!friendId) continue;

        try {
          const res = await axios.post('http://localhost:8081/api/searchbyid', {
            id: friendId
          });

          if (res.data.code === 200) {
            const friendInfo = res.data.data;
            const friendWithStatus = {
              ...friendInfo,
              status: f.status,
              friendId: friendId
            };

            if (f.status === 3) {
              this.groupedFriends['置顶'].push(friendWithStatus);
            } else if (f.status === 0) {
              this.groupedFriends['拉黑'].push(friendWithStatus);
            } else {
              this.groupedFriends['好友'].push(friendWithStatus);
            }
          }
        } catch (err) {
          console.error('获取好友信息失败:', err);
        }
      }
    },
    async loadFriendsList() {
      try {
        const res = await axios.post('http://localhost:8081/api/searchfs', {
          nickName: this.nickname
        });

        if (res.data.code === 200) {
          this.friendsList = res.data.data || [];
          console.log(this.friendsList);
          this.groupFriends(this.friendsList);
        } else {
          this.$message.warning('加载好友列表失败');
        }
      } catch (err) {
        console.error('加载好友列表失败:', err);
        this.$message.error('加载好友列表失败');
      }
    },
    async confirmJoinGroup(group) {
  this.$confirm(`确定加入群聊【${group.name}】吗？`, '加入确认', {
    confirmButtonText: '加入',
    cancelButtonText: '取消',
    type: 'info'
  }).then(async () => {
    try {
      const res = await axios.post('http://localhost:8081/group/joingrp', {
        accountId: this.id,
        groupId: group.id
      });

      if (res.data.code === 200) {
        this.$message.success('加入群聊成功');
        group.joined = true; // 更新状态
        //刷新群聊列表数据
        await this.loadGroupedGroups();
      } else {
        this.$message.warning('加入群聊失败');
      }
    } catch (err) {
      this.$message.error('加入失败');
      console.error(err);
    }
  }).catch(() => {
    // 用户取消
  });
},
// 加载群聊分组数据
    async loadGroupedGroups() {
      try {
        const res = await axios.post('http://localhost:8081/group/getGroupedGroups', {
          accountId: this.id
        });
        
        if (res.data.code === 200) {
          // 转换分组名称
          const groupedGroups = {};
          if (res.data.data.createdGroups) {
            groupedGroups['我创建的群聊'] = res.data.data.createdGroups;
          }
          if (res.data.data.managedGroups) {
            groupedGroups['我管理的群聊'] = res.data.data.managedGroups;
          }
          if (res.data.data.joinedGroups) {
            groupedGroups['我加入的群聊'] = res.data.data.joinedGroups;
          }
          this.groupedGroups = {...groupedGroups};
        } else {
          this.$message.error('获取群聊分组失败');
        }
      } catch (err) {
        console.error('获取群聊分组失败:', err);
      }
    }

  },
  

  components: {
    ChatFunc,
    FriendFunc,
    WorldFunc,
    UserDetail
  }
};
</script>

<style scoped>
/* 用户信息弹窗样式 */
.user-info-dialog {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: none;
}

.user-info-dialog .el-dialog__header {
  padding: 0;
}

.user-info-dialog .el-dialog__body {
  padding: 20px;
}

.user-info-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.avatar-container {
  position: relative;
  margin-bottom: 20px;
}

.large-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.edit-avatar-btn {
  position: absolute;
  right: 5px;
  bottom: 5px;
  background: #409EFF;
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 16px;
}

.user-details {
  text-align: center;
}

.user-details .nickname {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.user-details .account-id {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* 编辑表单样式 */
.avatar-uploader {
  position: relative;
  width: 120px;
  height: 120px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  margin: 0 auto;
}

.avatar-uploader:hover {
  border-color: #409EFF;
}

.avatar-uploader .avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  line-height: 120px;
  text-align: center;
}

.avatar-upload-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-tip {
  text-align: center;
  margin-top: 10px;
  font-size: 12px;
  color: #999;
}

/* 左侧头像添加点击事件 */
.user-avatar {
  cursor: pointer;
  transition: transform 0.3s;
}

.user-avatar:hover {
  transform: scale(1.05);
}
#chat-container {
  position: relative;
  height: 100vh;
  display: flex;
  font-family: '微软雅黑', sans-serif;
}

.background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('~@/assets/images/city.jpg') no-repeat center center fixed;
  background-size: cover;
  z-index: -1;
  
}

.sidebar {
  width: 80px;
  background-color: #f5f4f700;
  padding: 20px 10px;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid #1403032c;
  backdrop-filter: blur(10px);
}

.user-avatar img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  margin-bottom: 10px;
  border-radius: 4px;
  /* 方形头像 */
}

.user-nickname {
  font-size: 12px;
  text-align: center;
  color: #f7f4f4;
}

.nav-buttons .el-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px 0;
}

.main-content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
}

.search-bar {
  max-width: 400px;
  margin-bottom: 30px;
}

.content {
  background-color: #ffffff00;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(4px);
}

.right-panel {
  width: 260px;
  background-color: #fafafa9f;
  padding: 20px;
  border-left: 1px solid #fafafa9f;
  backdrop-filter: blur(6px);
}

.search-results ul {
  list-style: none;
  padding: 0;
  margin-top: 10px;
}

.search-results li {
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  backdrop-filter: blur(6px);
}

.search-results li:hover {
  background-color: #f0f0f0;
}

.result-avatar {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  margin-right: 10px;
}

.logout-button {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
}
.group-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.group-info {
  flex: 1;
  margin-left: 10px;
}

</style>