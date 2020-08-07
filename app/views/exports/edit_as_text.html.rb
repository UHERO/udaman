<h1>Editing Series for <%= @export.name %></h1>

<%= form_with url: { action: :save_as_text, id: @data_list } do |f| %>
  <%= text_area_tag :edit_box, @prefix_list, rows: 30, cols: 30 %>
  <p>
  <%= f.submit 'Store list' %>
  <%= link_to 'Cancel', :back %>
  </p>
<% end %>
