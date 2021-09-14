module MiscHelper

  def get_branch_code_sql
    number = ApplicationRecord.connection.execute(<<~MYSQL)
      select last_branch_code_number from last_branch_code
    MYSQL
  end

end
