class CreateSidekiqFailures < ActiveRecord::Migration[5.2]
  def change
    create_table :sidekiq_failures do |t|
      t.belongs_to :series
      t.string     :message
      t.timestamps
    end
  end
end
