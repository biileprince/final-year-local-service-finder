import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  UsersRepository,
  CreateUserData,
  UpdateUserData,
} from "./users.repository";
import * as bcrypt from "bcrypt";
import { PasswordSecurityService } from "../../common/security/password-security.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordSecurityService: PasswordSecurityService,
  ) {}

  async create(data: CreateUserData) {
    return this.usersRepository.create(data);
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async update(id: string, data: UpdateUserData) {
    await this.findById(id); // Ensure user exists
    return this.usersRepository.update(id, data);
  }

  async updateLastLogin(id: string) {
    return this.usersRepository.updateLastLogin(id);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findByIdWithPassword(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new ConflictException("Current password is incorrect");
    }

    // Reject passwords that appear in known breach corpora.
    await this.passwordSecurityService.assertNotBreached(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(id, hashedPassword);

    return { message: "Password updated successfully" };
  }

  async delete(id: string) {
    await this.findById(id); // Ensure user exists
    await this.usersRepository.softDelete(id);
    return { message: "User deleted successfully" };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, role, search } = params;
    const skip = (page - 1) * limit;

    return this.usersRepository.findAll({
      skip,
      take: limit,
      role,
      search,
    });
  }
}
