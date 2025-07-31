<template>
  <div class="user-detail">
    <img :src="localUser.image" alt="头像" style="width:80px; height:80px; border-radius:50%;" />
    <el-descriptions title="用户信息" :column="1" border>
      <el-descriptions-item label="昵称">{{ localUser.nickName }}</el-descriptions-item>
      <el-descriptions-item label="用户ID">{{ localUser.accountId }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{ localUser.remark }}</el-descriptions-item>
    </el-descriptions>

    <!-- 如果是普通用户，显示添加好友按钮 -->
    <div v-if="!localUser.isFriend && localUser.nickName !== nickName" class="add-friend-button">
      <el-button type="primary" @click="confirmAddFriend">添加好友</el-button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
export default {
  props: {
    user: {
      type: Object,
      required: true
    },
    nickName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      // 使用本地状态保存用户信息
      localUser: { ...this.user }
    };
  },
  watch: {
    user: {
      handler(newVal) {
        this.localUser = { ...newVal };
      },
      deep: true
    }
  },
  methods: {
    async confirmAddFriend() {
      this.$confirm('是否确认添加该用户为好友？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }).then(async () => {
        try {
          const res = await axios.post('http://localhost:8081/api/addfs', {
            nickName1: this.$parent.nickname,
            nickName2: this.localUser.nickName
          });

          if (res.data.code === 200) {
            this.$message.success('添加好友成功');
            // 更新本地状态而不是直接修改 prop
            this.localUser.remark = '好友';
            this.localUser.isFriend = true;
          } else {
            this.$message.error('添加好友失败');
          }
        } catch (err) {
          this.$message.error('请求失败，请稍后再试');
          console.error(err);
        }
      }).catch(() => {
        this.$message.info('已取消添加');
      });
    },

  }
};

</script>

<style scoped>
.user-detail {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.add-friend-button {
  margin-top: 20px;
  text-align: center;
}
</style>