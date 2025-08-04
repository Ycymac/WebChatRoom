<template>
  <div class="friend-container">
    <!-- 群成员面板 -->
      <el-dialog
  title="群聊成员"
  :visible.sync="showMemberDialog"
  width="500px"
  append-to-body
>
  <div v-if="memberList.length">
    <el-row v-for="member in memberList" :key="member.id" class="member-item" align="middle" justify="space-between">
      <el-col :span="18" class="member-info">
        <img :src="member.image || defaultGroupAvatar" class="group-avatar" @error="setDefaultGroupImage" />
        <span class="member-name">{{ member.nickName }}</span>
        <span class="member-account">（账号：{{ member.accountId }}）</span>
      </el-col>

      <el-col :span="6" class="member-actions" v-if="isGroupCreator(selectedGroup)">
        <template v-if="member.id !== id">
          <el-button
            type="danger"
            size="mini"
            @click="kickMember(member)"
          >踢出群聊</el-button>

          <el-button
            :type="member.identity === 2 ? 'warning' : 'primary'"
            size="mini"
            @click="toggleAdmin(member)"
          >
            {{ member.identity === 2 ? '撤销管理员' : '设为管理员' }}
          </el-button>
        </template>
      </el-col>
    </el-row>
  </div>

  <div v-else style="text-align: center; padding: 20px;">暂无成员信息</div>
</el-dialog>

    <!-- 创建群聊按钮（固定在右下角） -->
    <div class="create-group-button" v-if="activeTab === 'groups'">
      <el-button 
        type="primary" 
        icon="el-icon-plus" 
        circle 
        @click="showCreateGroupDialog = true"
      ></el-button>
    </div>

    <!-- 创建群聊对话框 -->
    <el-dialog 
      title="创建群聊" 
      :visible.sync="showCreateGroupDialog" 
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form :model="groupForm" label-width="80px">
        <el-form-item label="群聊名称" required>
          <el-input 
            v-model="groupForm.name" 
            placeholder="请输入群聊名称"
            maxlength="20"
            show-word-limit
          ></el-input>
        </el-form-item>
        
        <el-form-item label="群聊头像">
          <el-upload
            class="avatar-uploader"
            action="http://localhost:8081/api/upload"
            :show-file-list="false"
            :on-success="handleAvatarSuccess"
            :before-upload="beforeAvatarUpload"
            name="image"
          >
            <img v-if="groupForm.image" :src="groupForm.image" class="avatar">
            <i v-else class="el-icon-plus avatar-uploader-icon"></i>
          </el-upload>
        </el-form-item>
      </el-form>
      
      <span slot="footer" class="dialog-footer">
        <el-button @click="showCreateGroupDialog = false">取 消</el-button>
        <el-button 
          type="primary" 
          @click="createGroup"
          :disabled="!groupForm.name"
        >
          创 建
        </el-button>
      </span>
    </el-dialog>

    <!-- 编辑群聊对话框 -->
<el-dialog 
  title="编辑群聊信息" 
  :visible.sync="showEditGroupDialog" 
  width="500px"
  :close-on-click-modal="false"
   append-to-body
   @closed="handleEditDialogClosed"
>
  <el-form :model="editGroupForm" label-width="80px">
    <el-form-item label="群聊名称">
      <el-input 
        v-model="editGroupForm.name" 
        placeholder="修改群聊名称（可选）"
        maxlength="20"
        show-word-limit
      ></el-input>
    </el-form-item>

    <el-form-item label="群聊头像">
      <el-upload
        class="avatar-uploader"
        action="http://localhost:8081/api/upload"
        :show-file-list="false"
        :on-success="handleEditAvatarSuccess"
        :before-upload="beforeAvatarUpload"
        name="image"
      >
        <img v-if="editGroupForm.image" :src="editGroupForm.image" class="avatar">
        <i v-else class="el-icon-plus avatar-uploader-icon"></i>
      </el-upload>
    </el-form-item>
  </el-form>

  <span slot="footer" class="dialog-footer">
    <el-button @click="showEditGroupDialog = false">取 消</el-button>
    <el-button 
      type="primary" 
      :disabled="!hasGroupChanges"
      @click="submitEditGroup"
    >
      保 存
    </el-button>
  </span>
</el-dialog>


    <el-tabs v-model="activeTab" @tab-click="handleTabClick">
      <!-- 好友标签页 -->
      <el-tab-pane label="好友" name="friends">
        <el-collapse v-model="activeFriendNames">
          <el-collapse-item 
            v-for="friend in friends" 
            :key="'friend-'+friend.id"
            :name="friend.id"
          >
            <template #title>
              <div class="friend-header">
                <img :src="friend.image" alt="头像" class="friend-avatar" @error="setDefaultImage">
                <span class="friend-nickname">{{ friend.nickName }}</span>
              </div>
            </template>
            <div class="friend-detail">
              <p>账号ID：{{ friend.accountId }}</p>
              <p>关系状态：
                <el-tag type="info">
                <span v-if="friend.relationship === 1" style="color: green">好友</span>
                <span v-else-if="friend.relationship === 0" style="color: red">拉黑</span>
                <span v-else-if="friend.relationship === 2" style="color: gray">临时会话</span>
                <span v-else-if="friend.relationship === 3" style="color: blue">置顶好友</span>
                </el-tag>
              </p>
              <el-button 
                v-if="friend.relationship !== 0" 
                type="warning" 
                size="mini"
                @click="blockFriend(friend)"
              >
                拉黑
              </el-button>
              <el-button 
                v-else 
                type="success" 
                size="mini"
                @click="unblockFriend(friend)"
              >
                取消拉黑
              </el-button>
              <el-button 
                v-if="friend.relationship !== 3" 
                type="primary" 
                size="mini"
                @click="pinFriend(friend)"
              >
                置顶
              </el-button>
              <el-button 
                v-else 
                type="success" 
                size="mini"
                @click="unpinFriend(friend)"
              >
                取消置顶
              </el-button>
              <el-button type="danger" size="mini" @click="confirmDelete(friend)">
                删除好友
              </el-button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>

      <!-- 群聊标签页 -->
      <el-tab-pane label="群聊" name="groups">
        <!-- 我创建的群聊 -->
        <div v-if="createdGroups.length" class="group-section">
          <h3 class="group-header">我创建的群聊</h3>
          <el-collapse v-model="activeGroupNames">
            <el-collapse-item 
              v-for="group in createdGroups" 
              :key="'c-'+group.id"
              :name="'c-'+group.id"
            >
              <template #title>
                <div class="group-title">
                  <img :src="group.image || defaultGroupAvatar" class="group-avatar" @error="setDefaultGroupImage">
                  <span>{{ group.name }}</span>
                </div>
              </template>
              <div class="group-detail">
                <p>群号: {{ group.groupIdentifyId }}</p>
                 
                <el-button 
                type="primary" 
                size="mini" 
                  @click="openEditGroupDialog(group)"
                  >
                   编辑群聊
                  </el-button>

                  <el-button 
                  type="success" 
                  size="mini"
                    @click="openMemberDialog(group)"
                  >
                    群成员 
                  </el-button>


                <el-button 
                  type="danger" 
                  size="mini"
                  @click="confirmDestoryGroup(group)"
                >
                  注销群聊
                </el-button>

              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 我管理的群聊 -->
        <div v-if="managedGroups.length" class="group-section">
          <h3 class="group-header">我管理的群聊</h3>
          <el-collapse v-model="activeGroupNames">
            <el-collapse-item 
              v-for="group in managedGroups" 
              :key="'m-'+group.id"
              :name="'m-'+group.id"
            >
              <template #title>
                <div class="group-title">
                  <img :src="group.image || defaultGroupAvatar" class="group-avatar" @error="setDefaultGroupImage">
                  <span>{{ group.name }}</span>
                </div>
              </template>
              <div class="group-detail">
                <p>群号: {{ group.groupIdentifyId }}</p>

                <el-button 
                  type="success" 
                  size="mini"
                    @click="openMemberDialog(group)"
                  >
                    群成员 
                  </el-button>

                <el-button 
                  type="warning" 
                  size="mini"
                  @click="confirmQuitGroup(group)"
                >
                  退出群聊
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 我加入的群聊 -->
        <div v-if="joinedGroups.length" class="group-section">
          <h3 class="group-header">我加入的群聊</h3>
          <el-collapse v-model="activeGroupNames">
            <el-collapse-item 
              v-for="group in joinedGroups" 
              :key="'j-'+group.id"
              :name="'j-'+group.id"
            >
              <template #title>
                <div class="group-title">
                  <img :src="group.image || defaultGroupAvatar" class="group-avatar" @error="setDefaultGroupImage">
                  <span>{{ group.name }}</span>
                </div>
              </template>
              <div class="group-detail">
                <p>群号: {{ group.groupIdentifyId }}</p>

                <el-button 
                  type="success" 
                  size="mini"
                    @click="openMemberDialog(group)"
                  >
                    群成员 
                  </el-button>

                <el-button 
                  type="warning" 
                  size="mini"
                  @click="confirmQuitGroup(group)"
                >
                  退出群聊
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
       //存储原始群聊信息用于比较
      originalGroup: null,
      // 创建群聊相关数据
      showCreateGroupDialog: false,
      groupForm: {
        name: '',
        image: ''
      },
      activeTab: 'friends',
      activeFriendNames: [],
      activeGroupNames: [],
      friends: [],
      createdGroups: [],
      managedGroups: [],
      joinedGroups: [],
      defaultGroupAvatar: require('@/assets/images/default-avatar.jpg'),
      showEditGroupDialog: false,
      
      editGroupForm: {
      id: null,
      name: '',
      image: ''
      },
      showMemberDialog: false,
      selectedGroup: null, // 当前选中的群聊对象
      memberList: [],       // 当前群聊成员

    };
  },
  computed: {
    // 检测群聊信息是否有变化
    hasGroupChanges() {
      if (!this.originalGroup) return false;
      
      return (
        this.editGroupForm.name !== this.originalGroup.name ||
        this.editGroupForm.image !== this.originalGroup.image
      );
    },
    id() {
      return Number(localStorage.getItem('id')) || null;
    }
  },
  mounted() {
    this.loadFriends();
  },
  methods: {
    async openMemberDialog(group) {
  this.selectedGroup = group;
  console.log("当前群聊创建者Id:"+group.creatorId);
  console.log('当前用户 ID:', this.id);
  console.log('当前群聊:', this.selectedGroup);
  console.log('群成员:', this.memberList);
  this.showMemberDialog = true;

  try {
    const res = await axios.post('http://localhost:8081/group/membersWithIdentity', {
      groupId: group.id
    });

    if (res.data.code === 200) {
      this.memberList = res.data.data;
    } else {
      this.$message.error('获取群成员失败');
    }
  } catch (err) {
    this.$message.error('请求出错');
    console.error(err);
  }
},async kickMember(member) {
  this.$confirm(`确定将【${member.nickName}】移出群聊吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await axios.post('http://localhost:8081/group/quitfrmgrp', {
        accountId: member.id,
        groupId: this.selectedGroup.id
      });

      if (res.data.code === 200) {
        this.$message.success('已移出成员');
        this.memberList = this.memberList.filter(m => m.id !== member.id);
      } else {
        this.$message.error('操作失败');
      }
    } catch (err) {
      this.$message.error('请求失败');
      console.error(err);
    }
  }).catch(() => {
    this.$message.info('已取消移除操作'); // 添加这行
  });
}
,async toggleAdmin(member) {
  const newIdentity = member.identity === 2 ? 1 : 2;
  const action = newIdentity === 2 ? '设为管理员' : '撤销管理员';

  try {
    const res = await axios.post('http://localhost:8081/group/editMemberIdentity', {
      accountId: member.id,
      groupId: this.selectedGroup.id,
      identity: newIdentity
    });

    if (res.data.code === 200) {
      member.identity = newIdentity;
      this.$message.success(`${action}成功`);
    } else {
      this.$message.error(`${action}失败`);
    }
  } catch (err) {
    this.$message.error('请求失败');
    console.error(err);
  }
}
,
isGroupCreator(group) {
  return group && group.creatorId === this.id;
}
,

    openEditGroupDialog(group) {
      // 记录原始群聊信息（深拷贝）
      this.originalGroup = {
        id: group.id,
        name: group.name,
        image: group.image
      };
      
      this.editGroupForm = {
        id: group.id,
        name: group.name,
        image: group.image
      };
      this.showEditGroupDialog = true;
    },
    
    // 新增方法：处理对话框关闭
    handleEditDialogClosed() {
      this.originalGroup = null;
    },

handleEditAvatarSuccess(res) {
  if (res.code === 200) {
    this.editGroupForm.image = res.data;
    this.$message.success('头像上传成功');
  } else {
    this.$message.error('头像上传失败');
  }
},

async submitEditGroup() {
  const { id, name, image } = this.editGroupForm;

  if (!name && !image) {
    this.$message.warning('请至少修改群聊名称或头像');
    return;
  }

  try {
    const res = await axios.post('http://localhost:8081/group/editInfo', {
      id,
      name,
      image
    });

    if (res.data.code === 200) {
      this.$message.success('群聊信息已更新');
      this.showEditGroupDialog = false;
      await this.loadGroupedGroups(); // 重新加载群聊
    } else {
      this.$message.error('更新失败');
    }
  } catch (err) {
    this.$message.error('请求失败');
    console.error(err);
  }
},

    // 创建群聊相关方法
    handleAvatarSuccess(res) {
      if (res.code === 200) {
        this.groupForm.image = res.data;
        this.$message.success('头像上传成功');
      } else {
        this.$message.error('头像上传失败');
      }
    },
    
    beforeAvatarUpload(file) {
      const isImage = file.type.startsWith('image/');
      const isLt5M = file.size / 1024 / 1024 < 100;
      
      if (!isImage) {
        this.$message.error('只能上传图片文件');
      }
      if (!isLt5M) {
        this.$message.error('图片大小不能超过100MB');
      }
      
      return isImage && isLt5M;
    },
    
    async createGroup() {
      if (!this.groupForm.name) {
        this.$message.warning('请输入群聊名称');
        return;
      }
      
      try {
        const res = await axios.post('http://localhost:8081/group/creategrp', {
          creatorId: this.id,
          name: this.groupForm.name,
          image: this.groupForm.image || this.defaultGroupAvatar
        });
        
        if (res.data.code === 200) {
          this.$message.success('群聊创建成功');
          this.$emit('refresh-groups');
          this.showCreateGroupDialog = false;
          
          // 重置表单
          this.groupForm = {
            name: '',
            image: ''
          };
          
          // 刷新群聊列表
          this.loadGroupedGroups();
        } else {
          this.$message.error(res.data.msg || '创建群聊失败');
        }
      } catch (err) {
        this.$message.error('创建群聊失败，请稍后再试');
        console.error(err);
      }
    },
    setDefaultImage(e) {
      e.target.src = require('@/assets/images/default-avatar.jpg');
    },
    setDefaultGroupImage(e) {
      e.target.src = this.defaultGroupAvatar;
    },
    handleChange(val) {
      console.log('展开面板：', val);
    },
    // 切换标签页
    handleTabClick(tab) {
      if (tab.name === 'groups' && 
          !this.createdGroups.length && 
          !this.managedGroups.length && 
          !this.joinedGroups.length) {
        this.loadGroupedGroups();
      }
    },
    
    // 加载好友列表
    async loadFriends() {
      try {
        const res = await axios.post('http://localhost:8081/api/searchfs', {
          nickName: localStorage.getItem('nickName')
        });

        if (res.data.code === 200 && res.data.data) {
          const friendships = res.data.data;
          const currentId = String(localStorage.getItem('id'));
          
          this.friends = await Promise.all(friendships.map(async (f) => {
            const id1 = String(f.id1);
            const id2 = String(f.id2);
            const otherId = (id1 === currentId ? id2 : id1);
            
            if (otherId === currentId) return null;
            
            const userRes = await axios.post('http://localhost:8081/api/searchbyid', {
              id: otherId
            });

            if (userRes.data.code === 200) {
              const account = userRes.data.data;
              return {
                id: account.id,
                nickName: account.nickName,
                accountId: account.accountId,
                image: account.image || require('@/assets/images/default-avatar.jpg'),
                relationship: f.status
              };
            }
            return null;
          }));
          
          this.friends = this.friends.filter(f => f !== null);
        } else {
          this.$message.info('暂无好友');
        }
      } catch (err) {
        this.$message.error('加载好友失败');
        console.error(err);
      }
    },
    
    // 加载群聊分组
    async loadGroupedGroups() {
      try {
        const res = await axios.post('http://localhost:8081/group/getGroupedGroups', {
          accountId: this.id
        });
        console.log("加载的群聊信息：", res.data.data.createdGroups);

        if (res.data.code === 200) {
          this.createdGroups = res.data.data.createdGroups || [];
          this.managedGroups = res.data.data.managedGroups || [];
          this.joinedGroups = res.data.data.joinedGroups || [];
          
          // 设置默认头像
          this.createdGroups.forEach(g => {
            if (!g.image) g.image = this.defaultGroupAvatar;
          });
          this.managedGroups.forEach(g => {
            if (!g.image) g.image = this.defaultGroupAvatar;
          });
          this.joinedGroups.forEach(g => {
            if (!g.image) g.image = this.defaultGroupAvatar;
          });
        }
      } catch (err) {
        this.$message.error('加载群聊失败');
        console.error(err);
      }
    },
    
    // 注销群聊
    async confirmDestoryGroup(group) {
      this.$confirm(`确定要注销群聊【${group.name}】吗？此操作不可撤销！`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const res = await axios.post('http://localhost:8081/group/dstygrp', {
            id: group.id
          });
          
          if (res.data.code === 200) {
            this.$message.success('群聊已注销');
            this.removeGroup(group);
            this.$emit('refresh-groups'); 
          } else {
            this.$message.error('注销失败');
          }
        } catch (err) {
          this.$message.error('操作失败');
          console.error(err);
        }
      }).catch(() => {
         this.$message.info('已取消注销群聊');
      });
    },
    
    // 退出群聊
    async confirmQuitGroup(group) {
      this.$confirm(`确定要退出群聊【${group.name}】吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }).then(async () => {
        try {
          const res = await axios.post('http://localhost:8081/group/quitfrmgrp', {
            accountId: this.id,
            groupId: group.id
          });
          
          if (res.data.code === 200) {
            this.$message.success('已退出群聊');
            this.removeGroup(group);
            this.$emit('refresh-groups');
          } else {
            this.$message.error('退出失败');
          }
        } catch (err) {
          this.$message.error('操作失败');
          console.error(err);
        }
      }).catch(() => {
        this.$message.info('已取消退出');
      });
    },
    
    // 从列表中移除群聊
    removeGroup(group) {
      this.createdGroups = this.createdGroups.filter(g => g.id !== group.id);
      this.managedGroups = this.managedGroups.filter(g => g.id !== group.id);
      this.joinedGroups = this.joinedGroups.filter(g => g.id !== group.id);
    },
    
    // 好友操作函数
    startChat(friend) {
      this.$message.info(`和 ${friend.nickName} 聊天`);
    },
    async confirmDelete(friend) {
      this.$confirm(`是否确认删除好友 ${friend.nickName}？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        const currentNickName = localStorage.getItem('nickName');
        try {
          const res = await axios.post('http://localhost:8081/api/deletefs', {
            nickName1: currentNickName,
            nickName2: friend.nickName
          });

          if (res.data.code === 200) {
            this.$message.success('删除成功');
            this.friends = this.friends.filter(f => f.id !== friend.id);
          } else {
            this.$message.error('删除失败');
          }
        } catch (err) {
          this.$message.error('请求失败');
          console.error(err);
        }
      }).catch(() => {
        this.$message.info('已取消删除');
      });
    },
    async blockFriend(friend) {
      await this.updateRelationship(friend, 0);
      friend.relationship = 0;
      this.$message.warning('已拉黑该好友');
    },
    async unblockFriend(friend) {
      await this.updateRelationship(friend, 1);
      friend.relationship = 1;
      this.$message.success('已取消拉黑');
    },
    async pinFriend(friend) {
      await this.updateRelationship(friend, 3);
      friend.relationship = 3;
      this.$message.success('已置顶该好友');
    },
    async unpinFriend(friend) {
      await this.updateRelationship(friend, 1);
      friend.relationship = 1;
      this.$message.success('已取消置顶');
    },
    async updateRelationship(friend, status) {
      const currentId = localStorage.getItem('id');
      const friendId = friend.id;

      try {
        const res = await axios.post('http://localhost:8081/api/setfs', {
          id1: currentId,
          id2: friendId,
          status: status
        });

        if (res.data.code !== 200) {
          this.$message.error('更新失败');
        }
      } catch (err) {
        this.$message.error('请求失败');
        console.error(err);
      }
    }
  }
};
</script>

<style scoped>
/* 创建群聊按钮样式 */
.create-group-button {
  position: fixed;
  right: 40px;
  bottom: 40px;
  z-index: 1000;
}

.create-group-button .el-button {
  width: 60px;
  height: 60px;
  font-size: 24px;
}

/* 头像上传样式 */
.avatar-uploader {
  display: inline-block;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.avatar-uploader:hover {
  border-color: #409EFF;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  line-height: 120px;
  text-align: center;
}

.avatar {
  width: 120px;
  height: 120px;
  display: block;
}
.friend-container {
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.group-section {
  margin-bottom: 20px;
}

.group-header {
  border-left: 4px solid #409EFF;
  padding-left: 10px;
  margin: 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: bold;
}

.group-title {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.group-avatar {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  margin-right: 12px;
  object-fit: cover;
  border: 1px solid #eee;
}

.friend-header {
  display: flex;
  align-items: center;
}

.friend-avatar {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  margin-right: 12px;
  object-fit: cover;
  border: 1px solid #eee;
}

.friend-nickname {
  font-weight: 500;
  font-size: 14px;
}

.friend-detail, .group-detail {
  padding: 15px 0 5px 40px;
  border-top: 1px solid #f0f0f0;
}

.friend-detail p, .group-detail p {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
}

.el-button {
  margin-right: 8px;
  margin-top: 8px;
  font-size: 12px;
}

.el-collapse-item {
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  overflow: hidden;
}

.el-collapse-item__header {
  padding: 0 15px;
  height: 56px;
}

.el-collapse-item__content {
  padding-bottom: 15px;
}
.member-item {
  margin: 10px 0;
  padding: 5px 0;
  border-bottom: 1px solid #f0f0f0;
}

.member-info {
  display: flex;
  align-items: center;
}

.member-info .group-avatar {
  width: 32px;
  height: 32px;
  margin-right: 10px;
}

.member-name {
  font-weight: 500;
  margin-right: 6px;
}

.member-account {
  font-size: 12px;
  color: #888;
}

</style>