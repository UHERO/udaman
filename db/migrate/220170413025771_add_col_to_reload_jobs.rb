class AddColToReloadJobs < ActiveRecord::Migration[5.2]
  def change
    add_column :reload_jobs, :update_public, :boolean, null: false, default: false, after: :finished_at
    add_column :reload_jobs, :params, :string, after: :finished_at
  end
end
