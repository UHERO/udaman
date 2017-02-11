class CreateUserFeedbacks < ActiveRecord::Migration
  def change
    create_table :user_feedbacks do |t|
      t.string :name
      t.string :email
      t.text :feedback
      t.text :notes
      t.boolean :resolved

      t.timestamps null: false
    end
  end
end
