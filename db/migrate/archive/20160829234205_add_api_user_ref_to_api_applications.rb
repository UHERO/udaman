class AddApiUserRefToApiApplications < ActiveRecord::Migration
  def change
    add_reference :api_applications, :api_user, index: true, foreign_key: true
  end
end
