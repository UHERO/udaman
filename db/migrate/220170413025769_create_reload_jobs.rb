class CreateReloadJobs < ActiveRecord::Migration[5.2]
  def change
    create_table :reload_jobs do |t|
      t.belongs_to :user
      t.datetime :created_at
      t.datetime :finished_at
      t.string :error
    end
    add_column :reload_queue, :status, %q{ENUM('processing','done','fail')}, after: :created_at
  end
end
