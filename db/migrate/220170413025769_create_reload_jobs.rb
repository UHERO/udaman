class CreateReloadJobs < ActiveRecord::Migration[5.2]
  def self.up
    create_table :reload_jobs do |t|
      t.belongs_to :user
      t.datetime :created_at, null: false
      t.datetime :finished_at
      t.string :error
    end
    add_column :reload_jobs, :status, %q{ENUM('processing','done','fail')}, null: true, after: :created_at

    create_table :reload_job_series, id: false do |t|
      t.belongs_to :reload_job
      t.belongs_to :series
    end
    add_index :reload_job_series, [:reload_job_id, :series_id], unique: true

    ## totally unrelated to this branch, just needed to get this extra thing done
    change_column_default :series, :dependency_depth, 0
  end

  def self.down
    drop_table :reload_jobs if table_exists? :reload_jobs
    drop_table :reload_job_series if table_exists? :reload_job_series
  end
end
