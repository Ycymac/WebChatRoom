<template>

  <div class="chat-container">
    <!-- 左侧群聊列表 -->
    <div class="group-list">
      <el-collapse v-model="activeGroups">
        <el-collapse-item v-for="group in filteredGroups" :key="group.name" :title="group.name" :name="group.name">
          <div class="group-item" v-for="grp in group.groups" :key="grp.id"
            :class="{ 'active': selectedGroup && selectedGroup.id === grp.id }" @click="selectGroup(grp)">
            <el-avatar :size="40" :src="grp.image" class="group-avatar"></el-avatar>
            <div class="group-info">
              <span class="group-name">{{ grp.name }}</span>
              <span v-if="grp.unreadCount > 0" class="unread-badge">{{ grp.unreadCount }}</span>
            </div>
            <div v-if="filteredGroups.length === 0" class="empty-tip">
              暂无群聊，请点击左上角搜索加入群聊
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 右侧群聊区域 -->
    <div class="chat-area">
      <!-- 群聊头部 -->
      <div class="chat-header" v-if="selectedGroup">
        <el-avatar :size="40" :src="selectedGroup.image" fit="cover" class="header-avatar"></el-avatar>
        <div class="header-info">
          <span class="group-name">{{ selectedGroup.name }}</span>
          <span class="group-id">ID: {{ selectedGroup.groupIdentifyId }}</span>
        </div>
      </div>
      <div class="chat-header placeholder" v-else>
        请选择群聊
      </div>

      <!-- 群聊消息区域 -->
      <div class="messages-container" ref="messagesContainer">
        <div v-for="message in messages" :key="message.id || message.clientMsgId"
          :class="['message', message.senderId === myId ? 'self' : 'other']">

          <el-avatar :size="36" :src="getAvatarForSender(message.senderId)" class="message-avatar"></el-avatar>
          <div class="message-bubble">
            <!-- 显示发送者名称（非自己） -->
            <div v-if="message.senderId !== myId" class="sender-name">
              {{ getNicknameForSender(message.senderId) }}
            </div>

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

      <!-- 群聊输入区域 -->
      <div class="input-area" v-if="selectedGroup">
        <!-- 禁言提示 -->
        <div v-if="myBannedStatus" class="ban-tip">
           您已被禁言，无法发送消息。
        </div>

  <!-- 正常输入区域 -->
        <template v-else>
          <div class="character-count">
            {{ inputMessage.length }}/100
          </div>
          <el-input v-model="inputMessage" type="textarea" :rows="3" placeholder="输入消息..." resize="none" maxlength="100" :disabled="myBannedStatus" 
          @keyup.enter.native="handleKeyUp"></el-input>
        <div class="input-actions">
          <el-button type="primary" @click="sendGroupMessage" :disabled="!canSendMessage || myBannedStatus">发送</el-button>
          <el-button icon="el-icon-paperclip" @click="triggerFileUpload" :disabled="myBannedStatus" :title="myBannedStatus ? '您已被禁言，无法发送文件' : ''" ></el-button>
          <input type="file" ref="fileInput" style="display: none" @change="handleFileUpload">
          </div>
          </template>
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
    },
    // 群聊列表数据，格式为：{ '分组名称': [群聊1, 群聊2, ...] }
    groupsList: {
      type: Object,
      required: true
    },
    // 群成员信息映射 {群ID: {成员ID: {nickName, avatar}}}
    groupMembers: {
      type: Object,
      default: () => ({}) // 设置默认值为空对象
    }
  },
  data() {
    return {
      activeGroups: [],
      selectedGroup: null,
      messages: [],
      inputMessage: '',
      isNearBottom: true,
      pollingActive: true,
      // 文件预览
      imagePreviewVisible: false,
      previewImageUrl: '',
      previewImageName: '',
      currentFile: null,
      // 未读消息计数
      unreadCounts: {},
      myBannedStatus: false,
    };
  },
  computed: {
    // 添加计算属性判断是否可以发送消息
    canSendMessage() {
      return this.inputMessage.trim().length > 0 &&
        this.inputMessage.length <= 100;
    },
    // 过滤掉空分组
    filteredGroups() {
      // 添加空值检查
      if (!this.groupsList || typeof this.groupsList !== 'object') {
        return [];
      }
      return Object.keys(this.groupsList)
        .filter(groupName => this.groupsList[groupName].length > 0)
        .map(groupName => ({
          name: groupName,
          groups: this.groupsList[groupName].map(grp => ({
            ...grp,
            unreadCount: this.unreadCounts[grp.id] || 0
          }))
        }));

    },

  },
  watch: {
    // 监听群聊列表变化
    groupsList: {
      immediate: true,
      deep: true,
      handler(newValue) {
        // 更新活动组
        this.activeGroups = this.filteredGroups.map(g => g.name);
        // 检查当前选中的群聊是否还存在
        if (this.selectedGroup) {
          const allGroups = Object.values(newValue).flat();
          const exists = allGroups.some(g => g.id === this.selectedGroup.id);

          if (!exists) {
            this.selectedGroup = null;
            this.messages = [];
          }
        }
      }
    },
    // 当选中群聊变化时加载聊天记录
    selectedGroup(newGroup) {
      if (newGroup) {
        // 重置未读计数
        this.unreadCounts[newGroup.id] = 0;
        this.loadMessages();
      } else {
        this.messages = [];
      }
    }
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
  },
  beforeDestroy() {
    this.pollingActive = false;

    const container = this.$refs.messagesContainer;
    if (container) {
      container.removeEventListener('scroll', this.checkScrollPosition);
    }
  },
  methods: {
    
    // 键盘事件处理
    handleKeyUp(event) {
      // 禁言情况下直接返回，不处理任何输入
    if (this.myBannedStatus) {
      this.$message.warning('您已被禁言，无法发送消息');
      return;
      }
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
          this.sendGroupMessage();
        }
      }
    },
    refreshGroupList() {
      // 通过事件总线通知父组件刷新群聊列表
      this.$emit('refresh-groups');
    },

    // 检查滚动位置
    checkScrollPosition() {
      const container = this.$refs.messagesContainer;
      if (!container) return;

      const threshold = 100;
      this.isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    },

    // 智能滚动
    smartScrollToBottom() {
      if (this.isNearBottom) {
        this.scrollToBottom();
      }
    },
    //获取自己在群聊当中的状态
    async fetchMyGroupStatus(groupId) {
  try {
    const res = await axios.post('http://localhost:8081/group/getRelationshipInfo', {
      groupId: groupId,
      userId: this.myId
    });
    if (res.data.code === 200 && res.data.data) {
      this.myGroupIdentity = res.data.data.identity;
      this.myBannedStatus = res.data.data.isBannedToPost;
    }
  } catch (err) {
    console.error('获取禁言状态失败:', err);
    this.myGroupIdentity = null;
    this.myBannedStatus = false;
  }
},

    // 选择群聊

    async selectGroup(group) {
      this.selectedGroup = group;
      // 加载群成员信息
      if (!this.groupMembers[group.id]) {
        await this.loadGroupMembers(group.id);
      }

      // 加载群消息
      await this.loadGroupMessages(group.id);
       // 【关键修复】
  // 在消息数据加载完毕后，我们使用 $nextTick 来确保
  // 在 Vue 完成 DOM 渲染之后，再执行滚动操作。
    this.$nextTick(() => {
      this.scrollToBottom();
      // 初始加载后，我们默认用户就在底部，以便新消息可以智能滚动
      this.isNearBottom = true; 
      });
      //加载当前身份&状态
      await this.fetchMyGroupStatus(group.id);

    },
    //加载群聊成员信息
    async loadGroupMembers(groupId) {
      try {
        const res = await axios.post('http://localhost:8081/group/members', {
          groupId: groupId
        });

        if (res.data.code === 200) {
          const memberList = res.data.data || [];

          // 将成员数组转换为以ID为键的对象
          const membersMap = {};
          memberList.forEach(member => {
            membersMap[member.id] = {
              nickName: member.nickName,
              avatar: member.image
            };
          });

          // 更新到Vue响应式系统
          this.$set(this.groupMembers, groupId, membersMap);
        }
      } catch (err) {
        console.error('加载群成员失败:', err);
      }
    },
    //针对性加载群聊消息记录
    async loadGroupMessages(groupId) {
      try {
        // 实现群消息加载逻辑
        const res = await axios.post('http://localhost:8081/groupmsg/loadmsg', {
          groupId: groupId
        });

        if (res.data.code === 200) {
          this.messages = res.data.data;
        }
      } catch (err) {
        console.error('加载群消息失败:', err);
      }
    },
    // 加载群聊记录
   /*  async loadMessages() {
      if (!this.selectedGroup) return;

      try {
        const response = await axios.post('http://localhost:8081/groupmsg/loadmsg', {
          groupId: this.selectedGroup.id
        });

        if (response.data.code === 200) {
          this.messages = response.data.data;
          // 滚动到底部
          this.$nextTick(() => {
            this.scrollToBottom();
            this.isNearBottom = true;
          });
        } else {
          this.$message.error('加载群聊记录失败');
        }
      } catch (error) {
        console.error('加载群聊记录出错:', error);
        this.$message.error('加载群聊记录失败');
      }
    }, */
    async loadMessages() {
  if (this.selectedGroup) {
    await this.loadGroupMessages(this.selectedGroup.id);
  }
},

    async startPolling() {
      // **新增的守卫逻辑**
      // 检查 myId 是否已经从父组件传递过来并有效
      if (!this.myId) {
        // 如果 myId 还没有值 (比如 null, undefined, 0)，
        // 则不执行轮询，而是等待1秒后再次尝试启动。
        console.log("正在等待 myId... 1秒后重试");
        setTimeout(() => this.startPolling(), 1000);
        return; // 立即退出当前这次无效的调用
      }

      // ---- 只有在 myId 有效时，才会执行到下面的循环 ----
      while (this.pollingActive) {
        try {
          // 这里的请求现在是安全的，因为 myId 一定有值
          //拉取自己的群聊消息
          const response = await axios.post('http://localhost:8081/groupmsg/poll', {
            userId: this.myId
          }, {
            timeout: 35000
          });

          if (response.data.code === 200 && response.data.data && response.data.data.length) {
            const newMessages = response.data.data;

            newMessages.forEach(newMsg => {
              //发送者的Id是自己并且客户端给自己发送的消息的临时id存在，说明是临时消息
              const echoIndex = (newMsg.senderId === this.myId && newMsg.clientMsgId)
                ? this.messages.findIndex(m => m.clientMsgId === newMsg.clientMsgId)
                : -1;
              // 情况一：自己的回声消息，已经在本地进行渲染，不需要进行渲染，继续执行循环  
              if (echoIndex !== -1) {
                this.$set(this.messages, echoIndex, { ...newMsg, status: 'sent' });
                return;
              }

              // 情况二：别人的新消息
              //在消息当中已经有了，不再进行渲染
              if (this.messages.some(m => m.id && m.id === newMsg.id)) {
                return;
              }
              //当前群聊的消息，进行渲染  
              if (this.selectedGroup && this.selectedGroup.id === newMsg.groupId) {
                this.messages.push(newMsg);
              } else {
                if (!this.unreadCounts[newMsg.groupId]) {
                  this.$set(this.unreadCounts, newMsg.groupId, 0);
                }
                this.unreadCounts[newMsg.groupId]++;
              }
            });

            if (newMessages.some(m => this.selectedGroup && m.groupId === this.selectedGroup.id)) {
              this.smartScrollToBottom();
            }
          }
        } catch (error) {
          if (error.code !== 'ECONNABORTED') {
            console.error('群聊长轮询出错:', error);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },
    
    async sendGroupMessage() {
      //检查是否被禁言·
      if (this.myBannedStatus) {
      this.$message.warning('您已被禁言，无法发送消息');
        return;
      }

      if (!this.inputMessage.trim() || !this.selectedGroup) return;

      // 准备文本消息的载荷
      const payload = {
        messageContent: this.inputMessage,
        isFile: false // 明确指出这不是文件消息
      };

      // 调用统一的发送方法
      await this.sendMessage(payload);

      // 清空输入框
      this.inputMessage = '';
    },

    // 滚动到底部展示消息
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
      const now = new Date();

      // 处理时区问题
      if (typeof time === 'string') {
        date.setHours(date.getHours());
      }

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const diffDays = Math.round((today - messageDate) / (1000 * 60 * 60 * 24));
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      if (diffDays === 0) {
        return `${hours}:${minutes}`;
      } else if (diffDays === 1) {
        return `昨天 ${hours}:${minutes}`;
      } else if (diffDays < 7) {
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return `周${weekdays[date.getDay()]} ${hours}:${minutes}`;
      } else {
        return `${month}/${day} ${hours}:${minutes}`;
      }
    },

    // 获取发送者头像
    getAvatarForSender(senderId) {
      if (senderId === this.myId) return this.myAvatar;

      if (this.selectedGroup && this.groupMembers[this.selectedGroup.id]) {
        const member = this.groupMembers[this.selectedGroup.id][senderId];
        return member ? member.avatar : require('@/assets/images/default-avatar.jpg');
      }
      return require('@/assets/images/default-avatar.jpg');
    },
    //昵称
    getNicknameForSender(senderId) {
      if (senderId === this.myId) return '我';

      if (this.selectedGroup && this.groupMembers[this.selectedGroup.id]) {
        const member = this.groupMembers[this.selectedGroup.id][senderId];
        return member ? member.nickName : '未知用户';
      }
      return '未知用户';
    },

    // 触发文件选择
    triggerFileUpload() {
      this.$refs.fileInput.click();
    },

    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        // 1. 先将文件上传到服务器
        const response = await axios.post('http://localhost:8081/api/uploadFile', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (response.data.code === 200) {
          const fileInfo = response.data.data;

          // 2. 准备文件消息的载荷
          const payload = {
            isFile: true,
            fileType: fileInfo.type,
            fileUrl: fileInfo.url,
            fileName: fileInfo.name,
            fileSize: parseInt(fileInfo.size),
            messageContent: `[文件] ${fileInfo.name}` // messageContent 字段最好不要为空
          };

          // 3. 调用统一的发送方法
          await this.sendMessage(payload);

        }
      } catch (error) {
        console.error('文件上传出错:', error);
        this.$message.error('文件上传失败');
      } finally {
        // 清空文件选择，以便可以再次选择相同的文件
        event.target.value = '';
      }
    },
    //通过消息载荷判断是什么类型的消息
    async sendMessage(messagePayload) {
      // 1. 生成唯一的客户端ID
      const clientMsgId = Date.now() + Math.random().toString(36).substr(2, 9);

      // 2. 构造完整的本地消息对象
      const localMessage = {
        ...messagePayload, // 合并传入的消息内容（文本或文件信息）
        clientMsgId: clientMsgId,
        senderId: this.myId,
        groupId: this.selectedGroup.id,
        sendTime: new Date().toISOString(),
        status: 'sending'
      };

      // 3. 乐观更新UI
      this.messages.push(localMessage);

      // 4. 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });

      try {
        // 5. 将消息发送到后端
        // 后端需要能够接收并回传 clientMsgId
        await axios.post('http://localhost:8081/groupmsg/send', localMessage);
        // **注意：成功逻辑之后的消息更新完全交给 startPolling 处理**
      } catch (error) {
        console.error('消息发送失败:', error);
        this.$message.error('消息发送失败');
        // 发送失败时更新UI
        const index = this.messages.findIndex(m => m.clientMsgId === clientMsgId);
        if (index !== -1) {
          this.$set(this.messages[index], 'status', 'failed');
        }
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
/* 禁言样式 */
.ban-tip {
  text-align: center;
  font-size: 14px;
  color: #f56c6c;
  margin-bottom: 10px;
  font-weight: bold;
}

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

.chat-container {
  display: flex;
  height: calc(100vh - 100px);
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

}

.group-list {
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

.group-name {
  font-weight: 600;
  font-size: 16px;
}

.group-id {
  font-size: 12px;
  color: #909399;
}

.messages-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f0f2f5;
  background-image: url('~@/assets/images/city.jpg');
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

.message.other .message-content {
  border-top-left-radius: 2px;
}

.message-time {
  font-size: 12px;
  color: #f8f5f5;
  margin-top: 4px;
  text-align: right;
}

.input-area {
  border-top: 1px solid #e6e6e6;
  padding: 15px;
  backdrop-filter: blur(6px);
  background-color: #fff;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.group-item:hover {
  background-color: #e6e6e6;
}

.group-item.active {
  background-color: #d9ecff;
}

.group-info {
  margin-left: 12px;
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
}

.el-collapse-item {
  margin-bottom: 10px;
}

.unread-badge {
  position: absolute;
  right: 0;
  top: 0;
  background-color: #f56c6c;
  color: white;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-size: 12px;
  padding: 0 5px;
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

.sender-name {
  font-size: 12px;
  color: #fafafa;
  margin-bottom: 4px;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
}

.empty-tip {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

::v-deep(.el-avatar img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>