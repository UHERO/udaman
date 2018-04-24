class CreateSidekiqFailures < ActiveRecord::Migration
  def change
    create_table :sidekiq_failures do |t|
      t.belongs_to :series
      t.string     :message
      t.timestamps
    end
  end
end
