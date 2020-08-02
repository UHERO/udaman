class DropUserFeedbacks < ActiveRecord::Migration[5.2]
  def change
    drop_table :user_feedbacks if table_exists? :user_feedbacks
  end
end
