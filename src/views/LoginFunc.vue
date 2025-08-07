<template>
  <div id="app">
    <!-- 背景图片 -->
    <div class="background"></div>
    <div v-if="!loginSuccess&&!isLoading">
      <!-- 页面内容 -->
      <div class="header animated fadeInDown" >欢迎来到WeChat网页聊天室！</div>
      <div class="main">
        <!-- 注册弹窗 -->
          <el-dialog title="注册新账号" :visible.sync="registerVisible" width="60vw" append-to-body >
            <el-form :model="registerForm" label-width="100px" :rules="registerRules" ref="registerFormRef">
              <!-- 账号ID -->
              <el-form-item label="账号ID" prop="accountId">
                <el-input v-model="registerForm.accountId" placeholder="example@example.com"
                  @input="checkAccountIdExist" @keyup.enter.native="focusNextField('nickName')" ref="accountIdInput" />
                <span v-if="accountIdExist" style="color: red;">该账号ID已被注册</span>
              </el-form-item>
              <!--头像-->
              <el-form-item label="头像" prop="image">
                <el-upload action="http://localhost:8081/api/upload" :show-file-list="false"
                  :on-success="handleImageSuccess" :before-upload="beforeImageUpload" accept="image/png, image/jpeg"
                  name="image" :limit="1" :on-exceed="handleExceed">
                  <el-button type="primary">上传头像</el-button>
                  <div slot="tip" class="el-upload__tip">仅支持 .png / .jpg 格式，大小不超过100MB</div>
                </el-upload>
                <div v-if="registerForm.image" style="margin-top: 10px;">
                  <img :src="registerForm.image" alt="预览" style="width: 60px; height: 60px; border-radius: 50%">
                </div>
              </el-form-item>

              <!-- 昵称 -->
              <el-form-item label="昵称" prop="nickName">
                <el-input v-model="registerForm.nickName" @input="checkNickNameExist"
                  @keyup.enter.native="focusNextField('password')" ref="nickNameInput" />
                <span v-if="nickNameExist" style="color: red;">该昵称已被使用</span>
              </el-form-item>

              <!-- 密码 -->
              <el-form-item label="密码" prop="password">
                <el-input v-model="registerForm.password" type="password" show-password
                  @keyup.enter.native="focusNextField('confirmPassword')" ref="passwordInput" />
              </el-form-item>

              <!-- 确认密码 -->
              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input v-model="registerForm.confirmPassword" type="password" show-password
                  @keyup.enter.native="handleRegister" ref="confirmPasswordInput" />
              </el-form-item>

              <el-button type="primary" @click="handleRegister">提交注册</el-button>
            </el-form>
          </el-dialog>
        <div class="login-card">
          <h2>登录</h2>
          <el-form class="login-form" :model="loginForm">
            <!-- 输入框消失 -->
            <el-form-item v-show="!loginSuccess && !isLoading">
              <el-input v-model="loginForm.accountId" placeholder="请输入账号ID" ref="accountId"
                @keyup.enter.native="focusOnPassword"></el-input>
            </el-form-item>

            <el-form-item v-show="!loginSuccess && !isLoading">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password
                ref="accountPassword" @keyup.enter.native="handleLogin"></el-input>
            </el-form-item>

            <!-- 登录按钮 -->
            <el-button v-show="!loginSuccess && !isLoading"  type="primary" @click="handleLogin" class="login-btn">登录Login</el-button>

            <!-- 头像显示 -->
            <div v-show="loginSuccess && isLoading" style="text-align: center; margin-top: 10px;">
              <img :src="userAvatar" alt="头像" style="width: 80px; height: 80px; border-radius: 50%;">
              <p>欢迎，{{ loginForm.accountId }}</p>
            </div>
          </el-form>

          <!-- 注册链接仅在未登录时显示 -->
          <el-button v-show="!loginSuccess && !isLoading" type="text"
            @click="showRegisterDialog">没有账号（・∀・（・∀・）？那就来注册一个0(∩_∩)0</el-button>
        </div>
      </div>
    </div>

    <div v-if="loginSuccess && !showChatPage && isLoading" class="main">
      <div class="login-card" style="text-align: center;">
        <img :src="userAvatar" alt="头像" style="width: 80px; height: 80px; border-radius: 50%;">
        <p>欢迎，{{ loginForm.accountId }}</p>
      </div>
    </div>

    <router-view v-if="showChatPage" />
  </div>
</template>

<script>
document.title = "WeChat网页聊天室";
import axios from 'axios';
export default {
  data() {
    const validateConfirmPass = (rule, value, callback) => {
      if (value !== this.registerForm.password) {
        callback(new Error('两次密码不一致'));
      } else {
        callback();
      }
    };

    return {
      registerVisible: false,
      loginForm: { accountId: '', password: '' },
      registerForm: {
        accountId: '',
        nickName: '',
        password: '',
        confirmPassword: '',
        image: null
      },
      accountIdExist: false,
      nickNameExist: false,
      registerRules: {
        accountId: [
          { required: true, message: '请输入账号ID', trigger: 'blur' },
          { validator: this.validateAccountId, trigger: 'blur' }
        ],
        nickName: [
          { required: true, message: '请输入昵称', trigger: 'blur' },
          { max: 20, message: '昵称最多20个字符', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          { max: 20, message: '密码最多20个字符', trigger: 'blur' }
        ],
        confirmPassword: [
          { required: true, message: '请再次输入密码', trigger: 'blur' },
          { validator: validateConfirmPass, trigger: 'blur' }
        ]
      },
      isAccountIdValid: false,
      isNickNameValid: false,
      loginSuccess: false,
      userAvatar: '', //用户头像URL
      showChatPage: false,
      isLoading: false, // 加载状态
    };
  },
  methods: {
    async handleLogin() {
      const { accountId, password } = this.loginForm;
      if (!accountId || !password) {
        this.$message.warning('请输入账号和密码');
        return;
      }
      this.isLoading = true;
      try {
        // 1. 先进行登录验证
        const response = await axios.post('http://localhost:8081/api/login', {
          accountId,
          password
        });

        if (response.data.code === 200) {
          const userData = response.data.data;

          // 2. 设置登录状态为在线
          const setOnline = await axios.post('http://localhost:8081/api/loginset', {
            id: userData.id
          });

          if (setOnline.data.code !== 200) {
            this.$message.error('登录状态更新失败');
            return;
          }

          this.$message.success('登录成功！o(*￣▽￣*)ブ');
          this.userAvatar = userData.image;

          // 存储用户信息
          localStorage.setItem('userAvatar', userData.image);
          localStorage.setItem('userId', userData.accountId);
          localStorage.setItem('nickName', userData.nickName);
          localStorage.setItem('id', userData.id);
          localStorage.setItem('status',userData.status);
          this.loginSuccess = true;

          

          // 跳转到聊天页面
          setTimeout(() => {
            this.isLoading=true;
            if (this.$route.name !== 'UserChat' || this.$route.params.encodedId !== userData.accountId) {
              this.showChatPage = true;
              this.$router.replace({
              name: 'UserChat',
              params: { encodedId: userData.accountId }
        });
      }
          }, 2000);


        } else {
          this.$message.error(response.data.message || '登录失败！请检查账号或密码');
          this.isLoading = false; // 登录失败时也重置加载状态
        }
      } catch (error) {
        if (error.response) {
          const errorMsg = error.response.data.message ||
            error.response.data.error ||
            '登录失败，请检查账号密码';
          this.$message.error(errorMsg);
        } else if (error.request) {
          this.$message.error('网络错误，请检查连接');
        } else {
          this.$message.error('发生未知错误');
        }
        console.error('登录错误详情:', error);
        this.isLoading = false; // 错误发生时也重置加载状态
      }
    },
    showRegisterDialog() {
      this.registerVisible = true;
    },

    focusOnPassword() {
      this.$refs.accountPassword.focus();
    },

    // ：聚焦到下一个字段
    focusNextField(fieldName) {
      this.$nextTick(() => {
        this.$refs[fieldName + 'Input'].focus();
      });
    },

    validateAccountId(rule, value, callback) {
      const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!pattern.test(value)) {
        callback(new Error('邮箱格式错误'));
      } else if (value.length > 30) {
        callback(new Error('账号ID不能超过30个字符'));
      } else {
        callback();
      }
    },

    clearPlaceholder(field) {
      if (this.registerForm[field] === 'example@example.com') {
        this.registerForm[field] = '';
      }
    },

    restorePlaceholder(field) {
      if (!this.registerForm[field]) {
        this.registerForm[field] = 'example@example.com';
      }
    },

    async checkAccountIdExist() {
      const id = this.registerForm.accountId;
      if (!id || id === 'example@example.com') {
        this.accountIdExist = false;
        return;
      }

      try {
        const res = await axios.post(`http://localhost:8081/api/checkaccountid`, { id });
        this.accountIdExist = res.data.code !== 200;
      } catch (e) {
        console.error('检查账号ID失败', e);
        this.accountIdExist = false;
      }
    },

    async checkNickNameExist() {
      const name = this.registerForm.nickName;
      if (!name) {
        this.nickNameExist = false;
        return;
      }

      try {
        const res = await axios.post(`http://localhost:8081/api/checknickname`, { name });
        this.nickNameExist = res.data.code !== 200;
      } catch (e) {
        console.error('检查昵称失败', e);
        this.nickNameExist = false;
      }
    },

    async handleRegister() {
      this.$refs.registerFormRef.validate(async valid => {
        if (valid) {
          if (!this.registerForm.image) {
            this.$message.warning('请上传头像后再提交注册');
            return;
          }

          try {
            const res = await axios.post('http://localhost:8081/api/register', {
              accountId: this.registerForm.accountId,
              nickName: this.registerForm.nickName,
              password: this.registerForm.password,
              image: this.registerForm.image // 上传头像URL
            });

            if (res.data.code === 200) {
              this.$message.success('注册成功！');
              this.registerVisible = false;
              this.registerForm = {
                accountId: '',
                nickName: '',
                password: '',
                confirmPassword: '',
                image: null
              };
            } else {
              this.$message.error(res.data.message || '注册失败');
            }
          } catch (e) {
            this.$message.error('请求失败，请重试');
            console.error(e);
          }
        } else {
          this.$message.warning('请确保所有信息正确、符合规范');
        }
      });
    },

    // 图片上传成功后
    handleImageSuccess(response) {
      this.registerForm.image = response.data;
      this.$message.success('头像上传成功');
    },
    // 限制上传格式
    beforeImageUpload(file) {
      const isValidType = ['image/jpeg', 'image/png'].includes(file.type);
      const isValidSize = file.size / 1024 / 1024 < 100;

      if (!isValidType) {
        this.$message.error('只能上传 png/jpg 格式图片');
        return false;
      }
      if (!isValidSize) {
        this.$message.error('图片大小不能超过 2MB');
        return false;
      }
      return true;
    },
    // 上传数量限制提示
    handleExceed() {
      this.$message.warning('只能上传一张头像');
    }

  }
};
</script>

<style scoped>
body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
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

.header {
  background-color: rgba(161, 61, 243, 0.308);
  color: rgb(245, 243, 243);
  text-align: center;
  padding: 20px 0;
  font-size: 24px;
  position: relative;
  z-index: 0;
  width: 100%;
  margin: 0 auto;
  backdrop-filter: blur(6px);
}

.main {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 60px);
  position: relative;
  z-index: 1;
}

.login-card {
  width: 400px;
  background: rgba(255, 255, 255, 0);
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  padding: 30px;
  backdrop-filter: blur(6px);
  transition: all 0.3s ease;
  color: #fcf9f9;
}

.login-card h2 {
  text-align: center;
  margin-bottom: 20px;
}

.login-form .el-input {
  margin-bottom: 15px;
}

.register-link {
  text-align: center;
  margin-top: 10px;
  color: #40a9ff;
  cursor: pointer;
}

.login-form {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.el-upload__tip {
  font-size: 12px;
  color: #999;
}
.el-input__inner {
  border-radius: 20px;
  transition: 0.3s;
}
.el-input__inner:focus {
  box-shadow: 0 0 5px #7c3aed;
}
.login-btn {
  border-radius: 20px;
  width: 50%;
  height: 40px;
  font-weight: bold;
  background-color: #7c3aed;
  transition: all 0.3s ease;
}
.login-btn:focus {
  outline: none;
}

.login-btn:hover {
  background-color: #6b21a8;
  transform: scale(1.05);
}
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animated {
  animation: fadeInDown 0.8s ease-out;
}
.register-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  
}

</style>