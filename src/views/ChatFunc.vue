<template>
  <div class="chat-container">
    <!-- 左侧好友列表 -->
    <div class="friend-list">
      <el-collapse v-model="activeGroups">
        <el-collapse-item v-for="group in filteredGroups" :key="group.name" :title="group.name" :name="group.name">
          <div class="friend-item" v-for="friend in group.friends" :key="friend.id"
            :class="{ 'active': selectedFriend && selectedFriend.id === friend.id }" @click="selectFriend(friend)">
            <el-avatar :size="40" :src="friend.image" class="friend-avatar"></el-avatar>
            <div class="friend-info">
              <span class="friend-name">{{ friend.nickName }}</span>
              <el-tag v-if="friend.status === 3" size="mini" type="warning">置顶</el-tag>
              <el-tag v-else-if="friend.status === 0" size="mini" type="danger">拉黑</el-tag>
              <span v-if="friendStatusMap[friend.id] === 0" class="online-indicator">●</span>
              <span v-else class="offline-indicator">●</span>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-area">
      <!-- 聊天头部 -->
      <div class="chat-header" v-if="selectedFriend">
        <el-avatar :size="40" :src="selectedFriend.image" class="header-avatar"></el-avatar>
        <div class="header-info">
          <span class="friend-name">{{ selectedFriend.nickName }}</span>
          <span v-if="selectedFriend && selectedFriend.onlineStatus" class="online-status">在线</span>
          <span v-else class="offline-status">离线</span>
        </div>
      </div>
      <div class="chat-header placeholder" v-else>
        请选择聊天好友
      </div>

      <!-- 聊天消息区域 -->
      <div class="messages-container" ref="messagesContainer">
        <div v-for="(message, index) in messages" :key="index"
          :class="['message', message.senderId === myId ? 'self' : 'friend']">
          <el-avatar :size="36" :src="message.senderId === myId ? myAvatar : selectedFriend.image"
            class="message-avatar"></el-avatar>
          <div class="message-bubble">
            <!-- 文件消息显示 -->
            <div v-if="message.isFile" class="file-message">
              <!-- 图片类型 -->
              <div v-if="message.fileType === 'image'" class="image-preview" @click="previewImage(message.fileUrl)">
                <img :src="message.fileUrl" alt="图片" class="preview-image">
                <div class="file-info">
                  <span class="file-name">{{ message.fileName }}</span>
                  <el-button type="text" @click.stop="downloadFile(message.fileUrl, message.fileName)">下载</el-button>
                </div>
              </div>

              <!-- 其他文件类型 -->
              <div v-else class="file-preview" @click="downloadFile(message.fileUrl, message.fileName)">
                <div class="file-icon">
                  <i :class="fileIconClass(message.fileType)"></i>
                </div>
                <div class="file-details">
                  <div class="file-name">{{ message.fileName }}</div>
                  <div class="file-size">{{ formatFileSize(message.fileSize) }}</div>
                </div>
                <el-button type="text" @click.stop="downloadFile(message.fileUrl, message.fileName)">下载</el-button>
              </div>
            </div>

            <!-- 文本消息 -->
            <div v-else class="message-content">{{ message.messageContent }}</div>

            <div class="message-time">{{ formatTime(message.sendTime) }}</div>
          </div>
        </div>
      </div>

      <!-- 聊天输入区域 -->
      <div class="input-area" v-if="selectedFriend && selectedFriend.status !== 0">
        <div class="character-count">
        {{ inputMessage.length }}/100
        </div>

        <el-input v-model="inputMessage" type="textarea" :rows="3" placeholder="输入消息..." resize="none"
          maxlength="100" @keyup.enter.native="handleKeyUp"></el-input>
        <div class="input-actions">
          <el-button type="primary" @click="sendMessage" :disabled="!canSendMessage">发送</el-button>
          <el-button icon="el-icon-paperclip" @click="triggerFileUpload"></el-button>
          <input type="file" ref="fileInput" style="display: none" @change="handleFileUpload">
        </div>
      </div>

      <!-- 图片预览弹窗 -->
      <el-dialog :visible.sync="imagePreviewVisible" append-to-body>
        <img :src="previewImageUrl" alt="预览图片" style="width: 100%; max-height: 80vh; display: block;">
        <div slot="footer" class="dialog-footer">
          <el-button @click="downloadFile(previewImageUrl, previewImageName)">下载图片</el-button>
          <el-button type="primary" @click="imagePreviewVisible = false">关闭</el-button>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  props: {
    friendsList: {
      type: Object,
      required: true
    },
    myId: {
      type: Number,
      required: true
    },
    myAvatar: {
      type: String,
      required: true
    },
    myNickName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      activeGroups: [],
      selectedFriend: null,
      messages: [],
      inputMessage: '',
      isNearBottom: true, // 判断用户是否在底部附近
      pollingActive: true, // 轮询状态标志
      //定时（不需要太频繁）查询好友在线状态
      friendStatusMap: {}, // 存储好友ID到状态的映射
      statusPollingInterval: null, // 状态轮询定时器
      //文件预览
      imagePreviewVisible: false,
      previewImageUrl: '',
      previewImageName: '',
      currentFile: null // 当前选择的文件
    };
  },
  computed: {
    // 添加计算属性判断是否可以发送消息
    canSendMessage() {
      return this.inputMessage.trim().length > 0 && 
             this.inputMessage.length <= 100;
    },
    //使用计算属性替代 v-for + v-if
    filteredGroups() {
      return Object.keys(this.friendsList)
        .filter(groupName => this.friendsList[groupName].length > 0)
        .map(groupName => ({
          name: groupName,
          friends: this.friendsList[groupName]
        }));
    },

    // 获取所有好友ID的列表
    allFriendIds() {
      const ids = new Set();
      for (const groupName in this.friendsList) {
        this.friendsList[groupName].forEach(friend => {
          ids.add(friend.id);
        });
      }
      return Array.from(ids);
    }

  },
  watch: {
    // 监听好友列表变化
    friendsList: {
      immediate: true,
      deep: true,
      handler() {
        // 更新活动组
        this.activeGroups = this.filteredGroups.map(g => g.name);
        this.fetchFriendStatuses();
      }
    },
    // 当选中好友变化时加载聊天记录
    selectedFriend(newFriend) {
      if (newFriend) {
        this.loadMessages();
      } else {
        this.messages = [];
      }
    },


  },
  mounted() {
    // 初始展开所有分组
    this.activeGroups = this.filteredGroups.map(g => g.name);

    // 启动长轮询
    this.startPolling();

    // 监听滚动事件
    this.$nextTick(() => {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.addEventListener('scroll', this.checkScrollPosition);
      }
    });

    this.startStatusPolling();
  },
  beforeDestroy() {
    // 清除轮询标志位（实际需要更复杂的取消机制）
    this.pollingActive = false;

    // 移除滚动监听
    const container = this.$refs.messagesContainer;
    if (container) {
      container.removeEventListener('scroll', this.checkScrollPosition);
    }

    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
  },
  methods: {
    // 修改键盘事件处理
    handleKeyUp(event) {
      // 检查是否按下了Ctrl+Enter组合键
      const isCtrlEnter = event.ctrlKey && event.key === 'Enter';
      
      // 检查是否按下了Shift+Enter组合键
      const isShiftEnter = event.shiftKey && event.key === 'Enter';
      
      // 处理普通Enter键（非组合键）
      if (event.key === 'Enter' && !isCtrlEnter && !isShiftEnter) {
        // 阻止默认行为（换行）
        event.preventDefault();
        
        // 发送消息
        if (this.canSendMessage) {
          this.sendMessage();
        }
      }
    },
    // 检查滚动位置
    checkScrollPosition() {
      const container = this.$refs.messagesContainer;
      if (!container) return;

      // 判断是否在底部100像素范围内
      const threshold = 100;
      this.isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    },

    // 智能滚动（只在合适时滚动到底部）
    smartScrollToBottom() {
      if (this.isNearBottom) {
        this.scrollToBottom();
      }
    },

    // 选择好友
    selectFriend(friend) {
      this.selectedFriend = friend;
    },

    // 加载聊天记录
    async loadMessages() {
      if (!this.selectedFriend) return;

      try {
        const response = await axios.post('http://localhost:8081/api/loadmsg', {
          id1: this.myId,
          id2: this.selectedFriend.id
        });

        if (response.data.code === 200) {
          this.messages = response.data.data;
          // 滚动到底部
          this.$nextTick(() => {
            this.scrollToBottom();
            this.isNearBottom = true;
          });
        } else {
          this.$message.error('加载聊天记录失败');
        }
      } catch (error) {
        console.error('加载聊天记录出错:', error);
        this.$message.error('加载聊天记录失败');
      }
    },
    // 长轮询方法
    async startPolling() {
      if (!this.myId) return;

      try {
        //获取自己的消息队列
        const response = await axios.post('http://localhost:8081/api/poll', {
          userId: this.myId
        }, {
          timeout: 35000//设置时间稍长于后端
          // 确保后端超时先触发（30秒），避免前端因网络延迟误判。
          // - 留出5秒缓冲时间，应对网络传输延迟。但是上述可能会导致消息无法实时传输给前端产生的“无法即使通讯”的错觉
        });
          //成功返回并有消息
        if (response.data.code === 200 && response.data.data) {
          response.data.data.forEach(msg => {
            // 只添加当前聊天窗口的消息
            if (this.selectedFriend &&
              (msg.senderId === this.selectedFriend.id || msg.receiverId === this.selectedFriend.id)) {
              console.log("当前消息："+msg.messageContent);
              this.messages.push(msg);
            }
          });


        }
      } catch (error) {
        console.error('长轮询出错:', error);
      } finally {
        // 递归调用实现持续轮询
        this.startPolling();
      }
    },
    // 发送消息
    async sendMessage() {
      if (!this.inputMessage.trim() || !this.selectedFriend) return;

      // 禁止给拉黑好友发消息
      if (this.selectedFriend.status === 0) {
        this.$message.warning('无法向已拉黑的好友发送消息');
        return;
      }

      const newMessage = {
        senderId: this.myId,
        receiverId: this.selectedFriend.id,
        messageContent: this.inputMessage,
        sendTime: new Date().toISOString()
      };

      try {
        // 调用发送接口
        await axios.post('http://localhost:8081/api/send', newMessage);

        // 自己发送的消息进行本地添加（优化用户体验）
        this.messages.push({
          ...newMessage,
          senderId: this.myId,
          receiverId: this.selectedFriend.id
        });

        this.inputMessage = '';
        // 发送消息后总是滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
          this.isNearBottom = true;
        });
      } catch (error) {
        console.error('发送失败:', error);
        this.$message.error('消息发送失败');
      }
    },

    // 滚动到消息底部
    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    // 格式化时间
    formatTime(time) {
      if (!time) return '';

      const date = new Date(time);

      //字符串格式时间
      if (typeof time === 'string') {
        date.setHours(date.getHours());
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      // 计算日期差异（单位：天）
      const diffDays = Math.round((today - messageDate) / (1000 * 60 * 60 * 24));

      // 获取月份和日期
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      // 获取小时和分钟
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      // 根据日期差异显示不同的格式
      if (diffDays === 0) {
        // 今天：只显示时间
        return `${hours}:${minutes}`;
      } else if (diffDays === 1) {
        // 昨天：显示"昨天"和时间
        return `昨天 ${hours}:${minutes}`;
      } else if (diffDays < 7) {
        // 一周内：显示星期几和时间
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return `周${weekdays[date.getDay()]} ${hours}:${minutes}`;
      } else {
        // 更早：显示完整日期和时间
        return `${month}/${day} ${hours}:${minutes}`;
      }
    },
    // 获取好友状态
    async fetchFriendStatuses() {
      if (this.allFriendIds.length === 0) return;

      try {
        const response = await axios.post('http://localhost:8081/api/friendstatuses', {
          friendIds: this.allFriendIds
        });

        if (response.data.code === 200) {
          this.friendStatusMap = response.data.data;

          // 更新当前选中好友的状态
          if (this.selectedFriend) {
            const status = this.friendStatusMap[this.selectedFriend.id];
            if (status !== undefined) {
              this.$set(this.selectedFriend, 'onlineStatus', status === 0);
            }
          }
        }
      } catch (error) {
        console.error('获取好友状态失败:', error);
      }
    },
    // 启动状态轮询
    startStatusPolling() {
      // 先立即获取一次
      this.fetchFriendStatuses();

      // 每30秒轮询一次
      this.statusPollingInterval = setInterval(() => {
        this.fetchFriendStatuses();
      }, 5500);
    },
    // 触发文件选择
    triggerFileUpload() {
      this.$refs.fileInput.click();
    },

    // 处理文件上传
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post('http://localhost:8081/api/uploadFile', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          withCredentials: true // 确保携带凭证
        });

        if (response.data.code === 200) {
          const fileInfo = response.data.data;

          const newMessage = {
            senderId: this.myId,
            receiverId: this.selectedFriend.id,
            isFile: true,
            fileType: fileInfo.type,
            fileUrl: fileInfo.url,
            fileName: fileInfo.name,
            fileSize: parseInt(fileInfo.size),
            sendTime: new Date().toISOString(),
            // 即使文件消息也需要有内容字段
            messageContent: `[文件] ${fileInfo.name}`
          };

          // 发送文件消息
          await this.sendFileMessage(newMessage);
        }
      } catch (error) {
        console.error('文件上传出错:', error);
        this.$message.error('文件上传失败');
      } finally {
        event.target.value = '';
      }
    },

    // 发送文件消息
    async sendFileMessage(message) {
      try {
        const response = await axios.post('http://localhost:8081/api/send', message, {
          withCredentials: true // 确保携带凭证
        });

        if (response.data.code === 200) {
          // 添加到本地消息列表
          this.messages.push({
            ...response.data.data, // 使用服务器返回的消息对象
            id: response.data.data.id
          });

          this.$nextTick(() => {
            this.scrollToBottom();
          });
        } else {
          this.$message.error('文件消息发送失败');
        }
      } catch (error) {
        console.error('文件消息发送失败:', error);
        this.$message.error('文件消息发送失败');
      }
    },

    // 预览图片
    previewImage(url) {
      this.previewImageUrl = url;
      this.previewImageName = url.substring(url.lastIndexOf('/') + 1);
      this.imagePreviewVisible = true;
    },

    // 下载文件
    downloadFile(url, fileName) {
      // 创建临时链接
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'file';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    // 获取文件图标类
    fileIconClass(fileType) {
      const iconMap = {
        'image': 'el-icon-picture',
        'video': 'el-icon-video-camera',
        'audio': 'el-icon-headset',
        'pdf': 'el-icon-document',
        'word': 'el-icon-document',
        'excel': 'el-icon-document',
        'file': 'el-icon-document'
      };
      return iconMap[fileType] || 'el-icon-document';
    },

    // 格式化文件大小
    formatFileSize(bytes) {
      if (typeof bytes !== 'number' || bytes === 0) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

  }

};
</script>

<style scoped>
/* 添加字数统计样式 */
.character-count {
  text-align: right;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
  height: 18px;
}

/* 调整输入区域样式 */
.input-area {
  position: relative;
  border-top: 1px solid #e6e6e6;
  padding: 15px;
  background-color: #fff;
}

/* 当达到字数限制时改变颜色 */
.character-count.limit-exceeded {
  color: #f56c6c;
  font-weight: bold;
}

/* 调整Element UI的计数器位置 */
::v-deep .el-textarea .el-input__count {
  background: transparent;
  bottom: 40px;
  right: 10px;
}
/* 样式保持不变，与之前相同 */
.chat-container {
  display: flex;
  height: calc(100vh - 100px);
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.friend-list {
  width: 260px;
  background-color: #f0f2f5;
  border-right: 1px solid #e6e6e6;
  overflow-y: auto;
  padding: 10px;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}

.chat-header {
  height: 60px;
  padding: 10px 20px;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  background-color: #f0f2f5;
}

.chat-header.placeholder {
  justify-content: center;
  color: #999;
}

.header-avatar {
  margin-right: 12px;
  
}

.header-info {
  display: flex;
  flex-direction: column;
}

.friend-name {
  font-weight: 600;
  font-size: 16px;
}

.online-status {
  font-size: 12px;
  color: #67c23a;
}

.offline-status {
  font-size: 12px;
  color: #909399;
}

.messages-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f0f2f5;
  background-image: url('~@/assets/images/city.jpg');
  /* 可选的聊天背景 */
  background-size: cover;
}

.message {
  display: flex;
  margin-bottom: 20px;
}

.message.self {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 60%;
  margin: 0 12px;
  position: relative;
}

.message-content {
  padding: 12px 16px;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  line-height: 1.5;
  word-break: break-word;
}

.message.self .message-content {
  background-color: #52eaf5;
  border-top-right-radius: 2px;
}

.message.friend .message-content {
  border-top-left-radius: 2px;
}

.message-time {
  font-size: 12px;
  color: #f8f4f4;
  margin-top: 4px;
  text-align: right;
}

.input-area {
  border-top: 1px solid #e6e6e6;
  padding: 15px;
  background-color: #fff;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.friend-item:hover {
  background-color: #e6e6e6;
}

.friend-item.active {
  background-color: #d9ecff;
}

.friend-info {
  margin-left: 12px;
  display: flex;
  flex-direction: column;
}

.el-collapse-item {
  margin-bottom: 10px;
}


.online-indicator {
  display: inline-block;
  margin-left: 8px;
  color: #67c23a;
  font-size: 12px;
}

.offline-indicator {
  display: inline-block;
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.online-status {
  font-size: 12px;
  color: #67c23a;
}

.offline-status {
  font-size: 12px;
  color: #909399;
}

.file-message {
  max-width: 300px;
  cursor: pointer;
}

.image-preview {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  display: block;
  transition: transform 0.3s;
}

.preview-image:hover {
  transform: scale(1.05);
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.file-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.file-preview {
  display: flex;
  align-items: center;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background-color: #f5f7fa;
  transition: background-color 0.3s;
}

.file-preview:hover {
  background-color: #ecf5ff;
}

.file-icon {
  margin-right: 10px;
  font-size: 24px;
  color: #409eff;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

/* 图片预览弹窗样式 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
}

::v-deep.el-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}




</style>